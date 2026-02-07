import 'dotenv/config';
import { ChromaVectorDBService } from './services/vector-db';
import { GeminiEmbeddingService, GeminiAskingService } from './services/llm/gemini';
import { MyCustomRAGService } from './services/rag';
import { createServer } from './api/server';
import { logger } from './utils/logger';

async function initializeServices() {
  logger.info('Initializing services...');

  if (!process.env.COLLECTION_NAME || process.env.COLLECTION_NAME.trim() === '') {
    throw new Error('COLLECTION_NAME environment variable is required');
  }

  if (!process.env.CHROMA_URL || process.env.CHROMA_URL.trim() === '') {
    throw new Error('CHROMA_URL environment variable is required');
  }

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  if (!process.env.GEMINI_EMBEDDING_MODEL || process.env.GEMINI_EMBEDDING_MODEL.trim() === '') {
    throw new Error('GEMINI_EMBEDDING_MODEL environment variable is required');
  }

  if (!process.env.GEMINI_ASK_MODEL || process.env.GEMINI_ASK_MODEL.trim() === '') {
    throw new Error('GEMINI_ASK_MODEL environment variable is required');
  }

  if (!process.env.RAG_N_RESULTS) {
    throw new Error('RAG_N_RESULTS environment variable is required');
  }

  if (!process.env.RAG_MIN_SIMILARITY) {
    throw new Error('RAG_MIN_SIMILARITY environment variable is required');
  }

  if (!process.env.PORT) {
    throw new Error('PORT environment variable is required');
  }

  const nResults = parseInt(process.env.RAG_N_RESULTS, 10);
  const minSimilarity = parseFloat(process.env.RAG_MIN_SIMILARITY);
  const port = parseInt(process.env.PORT, 10);

  if (isNaN(nResults) || nResults <= 0) {
    throw new Error('RAG_N_RESULTS must be a positive number');
  }

  if (isNaN(minSimilarity) || minSimilarity < 0 || minSimilarity > 1) {
    throw new Error('RAG_MIN_SIMILARITY must be a number between 0 and 1');
  }

  if (isNaN(port) || port <= 0) {
    throw new Error('PORT must be a valid positive number');
  }

  const vectorDB = await ChromaVectorDBService.create({
    collectionName: process.env.COLLECTION_NAME,
    chromaUrl: process.env.CHROMA_URL,
  });

  const embeddingService = GeminiEmbeddingService.create({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: process.env.GEMINI_EMBEDDING_MODEL,
  });

  const askingService = GeminiAskingService.create({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: process.env.GEMINI_ASK_MODEL,
  });

  const ragService = MyCustomRAGService.create(vectorDB, embeddingService, askingService, {
    nResults,
    minSimilarity,
  });

  logger.info('✓ All services initialized successfully');

  return { ragService, port };
}

async function startServer() {
  try {
    const { ragService, port } = await initializeServices();

    const app = createServer(ragService);

    app.listen(port, () => {
      logger.info(`✓ Server is running on http://localhost:${port}`);
      logger.info(`  POST /chatbot/ask - Ask a question`);
      logger.info(`  GET  /health      - Health check`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

startServer();