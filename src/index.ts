import 'dotenv/config';
import { createServer } from './api/server.js';
import { initializeServices } from './services/init.js';
import { logger } from './utils/logger.js';

async function startServer() {
  try {
    const { generatorService, retrieverService, parentChunkStore, port } =
      await initializeServices();

    const app = createServer(generatorService, retrieverService);

    const server = app.listen(port, () => {
      logger.info(`Server is running on http://localhost:${port}`);
      logger.info('  POST /chatbot/ask - Ask a question');
      logger.info('  GET  /health      - Health check');
      logger.info('  POST /mcp         - MCP Streamable HTTP');
    });

    const shutdown = () => {
      logger.info('Shutting down gracefully...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await parentChunkStore.close();
        logger.info('Database connections closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error(
      'Failed to start server',
      error instanceof Error ? error : undefined,
    );
    process.exit(1);
  }
}

startServer();
