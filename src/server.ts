import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { CodeSlicer, SliceResult } from './slicer';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for code
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'monolith-slicer-api' });
});

// POST /api/slice - Slice monolith code in memory
app.post('/api/slice', (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    // Validate input
    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Request body must contain a "code" field with string value',
      });
      return;
    }

    if (code.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Code cannot be empty',
      });
      return;
    }

    // Create slicer instance and process code
    const slicer = new CodeSlicer({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      generateDockerfiles: true,
    });

    const result: SliceResult = slicer.sliceInMemory(code);

    // Debug: Log the result to verify data generation
    console.log('\n=== BACKEND DEBUG ===');
    console.log('Total services:', result.totalServices);
    if (result.services.length > 0) {
      console.log('First service name:', result.services[0].serviceName);
      console.log('Tests length:', result.services[0].tests?.length || 0);
      console.log('AgentsMd length:', result.services[0].agentsMd?.length || 0);
      console.log('Tests preview:', result.services[0].tests?.substring(0, 100) || 'EMPTY');
      console.log('AgentsMd preview:', result.services[0].agentsMd?.substring(0, 100) || 'EMPTY');
    }
    console.log('===================\n');

    // Return sliced services
    res.json({
      success: true,
      data: result,
      message: `Successfully sliced into ${result.totalServices} service(s)`,
    });
  } catch (error) {
    console.error('Error slicing code:', error);

    res.status(500).json({
      error: 'Slicing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Monolith Slicer API Server`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔪 Slice endpoint: POST http://localhost:${PORT}/api/slice\n`);
});

export default app;

// Made with Bob
