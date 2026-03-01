import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  GeminiAskingService,
  GeminiEmbeddingService,
} from './llm/gemini/index.js';
import { SQLiteParentChunkStore } from './parent-chunk-store/index.js';
import type { ParentChunkDocumentStore } from './parent-chunk-store/parent-chunk-store.interface.js';
import type { GeneratorService } from './rag/generator/generator.interface.js';
import {
  MyCustomGeneratorService,
  MyCustomRetrieverService,
} from './rag/index.js';
import type { RetrieverService } from './rag/retriever/retriever.interface.js';
import { ChromaVectorDBService } from './vector-db/index.js';

export interface InitializedServices {
  retrieverService: RetrieverService;
  generatorService: GeneratorService;
  parentChunkStore: ParentChunkDocumentStore;
  port: number;
}

export async function initializeServices(): Promise<InitializedServices> {
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

  const retrieverService = MyCustomRetrieverService.create(
    vectorDB,
    embeddingService,
    parentChunkStore,
    {
      nResults: config.ragNResults,
      minSimilarity: config.ragMinSimilarity,
    },
  );

  const generatorService = MyCustomGeneratorService.create(
    retrieverService,
    askingService,
  );

  logger.info('All services initialized successfully');

  return {
    retrieverService,
    generatorService,
    parentChunkStore,
    port: config.port,
  };
}
