import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

interface RouteInfo {
  method: string;
  path: string;
  node: t.Node;
}

interface ServiceRoutes {
  [serviceName: string]: RouteInfo[];
}

interface SlicerOptions {
  maxFileSize?: number; // in bytes
  allowedExtensions?: string[];
  generateDockerfiles?: boolean;
}

export interface SlicedService {
  serviceName: string;
  serviceCode: string;
  dockerfile: string;
  swagger: string;
  cicd: string;
  tests: string;
  agentsMd: string;
}

export interface SliceResult {
  services: SlicedService[];
  totalServices: number;
}

export class CodeSlicer {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default
  private readonly ALLOWED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];
  private readonly options: Required<SlicerOptions>;

  constructor(options: SlicerOptions = {}) {
    this.options = {
      maxFileSize: options.maxFileSize || this.MAX_FILE_SIZE,
      allowedExtensions: options.allowedExtensions || this.ALLOWED_EXTENSIONS,
      generateDockerfiles: options.generateDockerfiles ?? true,
    };
  }

  /**
   * Validate file path to prevent path traversal attacks
   */
  private validateFilePath(filePath: string): void {
    const resolvedPath = path.resolve(filePath);
    const normalizedPath = path.normalize(filePath);

    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal detected: Invalid file path');
    }

    // Validate file extension
    const ext = path.extname(filePath);
    if (!this.options.allowedExtensions.includes(ext)) {
      throw new Error(
        `Invalid file extension: ${ext}. Allowed: ${this.options.allowedExtensions.join(', ')}`
      );
    }

    // Check if file exists and is a file (not directory)
    if (!fsSync.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fsSync.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Check file size
    if (stats.size > this.options.maxFileSize) {
      throw new Error(
        `File too large: ${stats.size} bytes (max: ${this.options.maxFileSize} bytes)`
      );
    }
  }

  /**
   * Parse a JavaScript file and extract Express routes
   */
  public async parseFile(filePath: string): Promise<string> {
    this.validateFilePath(filePath);

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      return code;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract service name from route path
   */
  private extractServiceName(routePath: string): string | null {
    // Extract the first path segment after the leading slash
    const match = routePath.match(/^\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract routes from code using AST parsing
   */
  public extractRoutes(code: string): ServiceRoutes {
    let ast;

    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true,
      });
    } catch (error) {
      throw new Error(`Failed to parse code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const routes: ServiceRoutes = {};
    const self = this; // Capture 'this' context for use in traverse callback

    traverse(ast, {
      CallExpression(nodePath) {
        const { node } = nodePath;

        // Check if it's an Express route definition (app.get, app.post, etc.)
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object, { name: 'app' }) &&
          t.isIdentifier(node.callee.property) &&
          ['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name)
        ) {
          const method = node.callee.property.name;
          const firstArg = node.arguments[0];

          if (t.isStringLiteral(firstArg)) {
            const routePath = firstArg.value;
            const serviceName = self.extractServiceName(routePath);

            if (serviceName) {
              const routeInfo: RouteInfo = {
                method,
                path: routePath,
                node: node,
              };

              // Initialize service array if it doesn't exist
              if (!routes[serviceName]) {
                routes[serviceName] = [];
              }

              routes[serviceName].push(routeInfo);
            }
          }
        }
      },
    });

    return routes;
  }

  /**
   * Generate Dockerfile for a service
   */
  private generateDockerfile(serviceName: string): string {
    return `# Node.js Dockerfile for ${serviceName} service
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \\
    npm cache clean --force

# Copy service file
COPY ${serviceName}-service.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001 && \\
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the service
CMD ["node", "${serviceName}-service.js"]
`;
  }

  /**
   * Generate service file from extracted routes
   */
  public async generateServiceFile(
    serviceName: string,
    routes: RouteInfo[],
    outputPath: string
  ): Promise<void> {
    try {
      const serviceCode = this.buildServiceCode(serviceName, routes);
      await fs.writeFile(outputPath, serviceCode, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to write service file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate Dockerfile for a service
   */
  public async generateDockerfileForService(
    serviceName: string,
    outputDir: string
  ): Promise<void> {
    try {
      const dockerfileContent = this.generateDockerfile(serviceName);
      const dockerfilePath = path.join(outputDir, `${serviceName}-service.Dockerfile`);
      await fs.writeFile(dockerfilePath, dockerfileContent, 'utf-8');
      console.log(`Generated Dockerfile at ${dockerfilePath}`);
    } catch (error) {
      throw new Error(
        `Failed to write Dockerfile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate Swagger/OpenAPI 3.0 specification for a service
   */
  private generateSwagger(serviceName: string, routes: RouteInfo[]): string {
    const paths: Record<string, any> = {};

    for (const route of routes) {
      const pathKey = route.path;
      if (!paths[pathKey]) {
        paths[pathKey] = {};
      }

      paths[pathKey][route.method] = {
        summary: `${route.method.toUpperCase()} ${route.path}`,
        description: `${route.method.toUpperCase()} operation for ${route.path}`,
        tags: [serviceName],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      };

      // Add request body for POST, PUT, PATCH
      if (['post', 'put', 'patch'].includes(route.method)) {
        paths[pathKey][route.method].requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
              },
            },
          },
        };
      }
    }

    const swagger = {
      openapi: '3.0.0',
      info: {
        title: `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Service API`,
        version: '1.0.0',
        description: `API documentation for ${serviceName} microservice`,
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.production.com',
          description: 'Production server',
        },
      ],
      tags: [
        {
          name: serviceName,
          description: `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} operations`,
        },
      ],
      paths,
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };

    return JSON.stringify(swagger, null, 2);
  }

  /**
   * Generate GitHub Actions CI/CD pipeline
   */
  private generateCICD(serviceName: string): string {
    return `name: Deploy ${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Service

on:
  push:
    branches:
      - main
      - develop
    paths:
      - '${serviceName}-service/**'
      - '.github/workflows/deploy-${serviceName}.yml'
  pull_request:
    branches:
      - main
      - develop

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}/${serviceName}-service

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run linter
        run: npm run lint

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./${serviceName}-service.Dockerfile
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying ${serviceName} service to production"
          # Add your deployment commands here
          # Example: kubectl set image deployment/${serviceName}-service ${serviceName}=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest
`;
  }

  /**
   * Generate Jest + Supertest unit tests for a service
   */
  private generateTests(serviceName: string, routes: RouteInfo[]): string {
    const testCases: string[] = [];

    for (const route of routes) {
      const methodUpper = route.method.toUpperCase();
      const testName = `${methodUpper} ${route.path}`;
      
      testCases.push(`
  describe('${testName}', () => {
    it('should return 200 status code', async () => {
      const response = await request(app)
        .${route.method}('${route.path}')${route.method === 'post' || route.method === 'put' || route.method === 'patch' ? `
        .send({ test: 'data' })` : ''}
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should return valid JSON response', async () => {
      const response = await request(app)
        .${route.method}('${route.path}')${route.method === 'post' || route.method === 'put' || route.method === 'patch' ? `
        .send({ test: 'data' })` : ''};
      
      expect(response.body).toBeInstanceOf(Object);
    });
  });`);
    }

    return `const request = require('supertest');
const express = require('express');

// Import your service
const app = express();
app.use(express.json());

// Add your routes here (or import them)
${routes.map(route => `// app.${route.method}('${route.path}', handler);`).join('\n')}

describe('${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Service Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('${serviceName}');
    });
  });
${testCases.join('\n')}
});

// Test suite configuration
describe('Service Configuration', () => {
  it('should have express.json() middleware', () => {
    expect(app._router).toBeDefined();
  });

  it('should handle 404 for unknown routes', async () => {
    await request(app)
      .get('/unknown-route')
      .expect(404);
  });
});
`;
  }

  /**
   * Generate service-specific AGENTS.md file
   */
  private generateAgentsMd(serviceName: string, routes: RouteInfo[]): string {
    const routesList = routes.map(r => `- ${r.method.toUpperCase()} ${r.path}`).join('\n');
    const capitalizedName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);

    return `# ${capitalizedName} Service - AI Agent Instructions

This file provides guidance for AI agents working on the ${capitalizedName} microservice.

## Service Context

**Service Name**: ${capitalizedName}
**Domain**: ${capitalizedName} Management
**Type**: Microservice (extracted from monolith)
**Framework**: Express.js

## Service Responsibilities

This microservice handles all ${serviceName}-related operations. It was automatically extracted from a monolithic application and is designed to operate independently.

## Available Endpoints

${routesList}

## Development Guidelines

### Code Style
- Use async/await for asynchronous operations
- Follow RESTful conventions for endpoint design
- Implement proper error handling with try-catch blocks
- Return consistent JSON response formats

### Testing
- All endpoints must have unit tests (Jest + Supertest)
- Maintain >80% code coverage
- Test both success and error scenarios
- Mock external dependencies

### API Design
- Use proper HTTP status codes (200, 201, 400, 404, 500)
- Include request validation middleware
- Implement rate limiting for production
- Add authentication/authorization as needed

### Database
- Use connection pooling for database access
- Implement proper transaction handling
- Add database migration scripts
- Use parameterized queries to prevent SQL injection

### Error Handling
- Return structured error responses
- Log errors with appropriate severity levels
- Don't expose internal error details to clients
- Implement circuit breakers for external service calls

### Performance
- Implement caching where appropriate
- Use pagination for list endpoints
- Add database indexes for frequently queried fields
- Monitor response times and optimize slow queries

### Security
- Validate and sanitize all inputs
- Use HTTPS in production
- Implement CORS properly
- Keep dependencies updated
- Use environment variables for sensitive data

### Deployment
- Service runs in Docker container
- Uses GitHub Actions for CI/CD
- Deploys to container registry (GHCR)
- Health check endpoint: GET /health

## Service Dependencies

- **Express**: Web framework
- **Body-parser**: Request parsing (built into Express)
- **Dotenv**: Environment configuration
- **Jest**: Testing framework
- **Supertest**: HTTP testing

## Environment Variables

\`\`\`
PORT=3000
NODE_ENV=production
DATABASE_URL=<connection-string>
API_KEY=<your-api-key>
\`\`\`

## Common Tasks

### Adding a New Endpoint
1. Define route in service file
2. Implement handler function
3. Add input validation
4. Write unit tests
5. Update OpenAPI spec
6. Update this AGENTS.md file

### Modifying Existing Endpoint
1. Update handler logic
2. Update tests
3. Update OpenAPI documentation
4. Test thoroughly before deploying

### Database Changes
1. Create migration script
2. Update models/schemas
3. Update affected endpoints
4. Add/update tests
5. Document changes

## Monitoring & Observability

- Health check endpoint for liveness probes
- Structured logging for debugging
- Metrics collection for performance monitoring
- Distributed tracing for request flow

## Notes for AI Agents

- This is a **newly extracted microservice** - treat it as a standalone application
- The service should be **stateless** and horizontally scalable
- Follow **12-factor app** principles
- Maintain **backward compatibility** when making changes
- Always consider **security implications** of code changes
- This service focuses specifically on **${serviceName} domain logic**
`;
  }

  /**
   * Build the service code from routes
   */
  private buildServiceCode(serviceName: string, routes: RouteInfo[]): string {
    const lines: string[] = [
      "const express = require('express');",
      'const app = express();',
      '',
      'app.use(express.json());',
      '',
      `// ${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} routes`,
    ];

    for (const route of routes) {
      try {
        const routeCode = generate(route.node).code;
        lines.push(routeCode, '');
      } catch (error) {
        console.warn(`Warning: Failed to generate code for route ${route.path}: ${error}`);
      }
    }

    lines.push(
      '// Health check endpoint',
      "app.get('/health', (req, res) => {",
      "  res.status(200).json({ status: 'healthy', service: '" + serviceName + "' });",
      '});',
      '',
      'const PORT = process.env.PORT || 3000;',
      'app.listen(PORT, () => {',
      `  console.log(\`${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} service running on port \${PORT}\`);`,
      '});'
    );

    return lines.join('\n');
  }

  /**
   * Slice a monolith into microservices
   */
  public async sliceMonolith(inputPath: string, outputDir: string): Promise<void> {
    try {
      // Validate and read the monolith
      const code = await this.parseFile(inputPath);
      const routes = this.extractRoutes(code);

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Generate service files and Dockerfiles
      const servicePromises: Promise<void>[] = [];

      for (const [serviceName, serviceRoutes] of Object.entries(routes)) {
        if (serviceRoutes.length > 0) {
          const outputPath = path.join(outputDir, `${serviceName}-service.js`);

          // Generate service file
          servicePromises.push(
            this.generateServiceFile(serviceName, serviceRoutes, outputPath).then(() => {
              console.log(`Generated ${serviceName} service at ${outputPath}`);
            })
          );

          // Generate Dockerfile if enabled
          if (this.options.generateDockerfiles) {
            servicePromises.push(this.generateDockerfileForService(serviceName, outputDir));
          }
        }
      }

      await Promise.all(servicePromises);
    } catch (error) {
      throw new Error(
        `Failed to slice monolith: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Slice code in memory without writing to filesystem
   * Returns service code and Dockerfiles as strings
   */
  public sliceInMemory(code: string): SliceResult {
    // Validate code size
    if (code.length > this.options.maxFileSize) {
      throw new Error(
        `Code too large: ${code.length} bytes (max: ${this.options.maxFileSize} bytes)`
      );
    }

    const routes = this.extractRoutes(code);
    const services: SlicedService[] = [];

    for (const [serviceName, serviceRoutes] of Object.entries(routes)) {
      if (serviceRoutes.length > 0) {
        const serviceCode = this.buildServiceCode(serviceName, serviceRoutes);
        const dockerfile = this.options.generateDockerfiles
          ? this.generateDockerfile(serviceName)
          : '';
        const swagger = this.generateSwagger(serviceName, serviceRoutes);
        const cicd = this.generateCICD(serviceName);
        const tests = this.generateTests(serviceName, serviceRoutes);
        const agentsMd = this.generateAgentsMd(serviceName, serviceRoutes);

        services.push({
          serviceName,
          serviceCode,
          dockerfile,
          swagger,
          cicd,
          tests,
          agentsMd,
        });
      }
    }

    return {
      services,
      totalServices: services.length,
    };
  }
}
