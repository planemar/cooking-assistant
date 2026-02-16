import 'dotenv/config';
import { createServer } from './api/server';
import { getConfig } from './config';
import {
  GeminiAskingService,
  GeminiEmbeddingService,
} from './services/llm/gemini';
import { SQLiteParentChunkStore } from './services/parent-chunk-store';
import { MyCustomRAGService } from './services/rag';
import { ChromaVectorDBService } from './services/vector-db';
import { logger } from './utils/logger';

async function initializeServices() {
  logger.info('Initializing services...');

  const config = getConfig();

  const vectorDB = await ChromaVectorDBService.create({
    collectionName: config.collectionName,
    chromaUrl: config.chromaUrl,
  });

  const embeddingService = GeminiEmbeddingService.create({
    apiKey: config.geminiApiKey,
    modelName: config.geminiEmbeddingModel,
  });

  const askingService = GeminiAskingService.create({
    apiKey: config.geminiApiKey,
    modelName: config.geminiAskModel,
  });

  const parentChunkStore = SQLiteParentChunkStore.create({
    dbPath: config.sqliteDbPath,
  });

  const ragService = MyCustomRAGService.create(
    vectorDB,
    embeddingService,
    askingService,
    parentChunkStore,
    {
      nResults: config.ragNResults,
      minSimilarity: config.ragMinSimilarity,
    },
  );

  logger.info('✓ All services initialized successfully');

  return { ragService, parentChunkStore, port: config.port };
}

async function startServer() {
  try {
    const { ragService, parentChunkStore, port } = await initializeServices();

    const app = createServer(ragService);

    const server = app.listen(port, () => {
      logger.info(`✓ Server is running on http://localhost:${port}`);
      logger.info(`  POST /chatbot/ask - Ask a question`);
      logger.info(`  GET  /health      - Health check`);
    });

    const shutdown = () => {
      logger.info('Shutting down gracefully...');
      server.close(async () => {
        logger.info('✓ HTTP server closed');
        await parentChunkStore.close();
        logger.info('✓ Database connections closed');
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
