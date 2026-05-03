# Monolith Slicer POC

A proof-of-concept tool for analyzing and slicing monolithic codebases into microservices.

## Features

- **Code Analysis**: Parse and analyze monolithic codebases using AST
- **Dependency Graphing**: Build comprehensive dependency graphs
- **Smart Slicing**: Intelligently slice monoliths into logical service boundaries

## Installation

```bash
npm install
```

## Usage

### Analyze a codebase

```bash
npm run dev analyze <path-to-codebase>
```

### Slice a monolith

```bash
npm run dev slice <path-to-codebase> --output ./output
```

## Development

### Build

```bash
npm run build
```

### Watch mode (for development)

```bash
npm run build:watch
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test
npm run test:single <test-pattern>

# Generate coverage report
npm run test:coverage
```

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Formatting

```bash
# Check formatting
npm run format:check

# Auto-format code
npm run format
```

## Project Structure

```
monolith-slicer-poc/
├── src/
│   ├── analyzer/       # Code analysis engine
│   ├── slicer/         # Slicing logic
│   ├── graph/          # Dependency graph builder
│   ├── utils/          # Shared utilities
│   └── cli/            # CLI interface
├── tests/
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── examples/           # Example monoliths
└── dist/               # Build output
```

## Architecture

The project is organized into four main modules:

- **Analyzer**: Parses source code and extracts structural information
- **Graph**: Builds and manages dependency graphs
- **Slicer**: Implements slicing algorithms to identify service boundaries
- **Utils**: Provides shared utilities and helpers

## Contributing

1. Follow the TypeScript strict mode guidelines
2. Ensure all tests pass before submitting
3. Run linting and formatting checks
4. Write tests for new features

## License

MIT