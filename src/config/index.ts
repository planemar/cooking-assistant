import { z } from 'zod';
import { logger } from '../utils/logger';

const configSchema = z.object({
  port: z.coerce.number().int().positive().describe('Server port'),
  logLevel: z
    .enum(['DEBUG', 'INFO', 'WARN', 'ERROR'])
    .describe('Logging level'),

  chromaUrl: z.string().url().describe('ChromaDB server URL'),
  collectionName: z.string().min(1).describe('ChromaDB collection name'),

  geminiApiKey: z.string().min(1).describe('Google Gemini API key'),
  geminiEmbeddingModel: z
    .string()
    .min(1)
    .describe('Gemini embedding model name'),
  geminiAskModel: z.string().min(1).describe('Gemini generation model name'),

  ragNResults: z.coerce
    .number()
    .int()
    .positive()
    .describe('Number of results to retrieve'),
  ragMinSimilarity: z.coerce
    .number()
    .min(0)
    .max(1)
    .describe('Minimum similarity threshold (0-1)'),

  documentsDir: z
    .string()
    .min(1)
    .describe('Directory containing recipe documents'),
  sqliteDbPath: z.string().min(1).describe('SQLite database file path'),

  childChunkSize: z.coerce
    .number()
    .int()
    .positive()
    .describe('Child chunk size in characters'),
  childChunkOverlapFactor: z.coerce
    .number()
    .min(0)
    .max(1)
    .describe('Child chunk overlap factor (0-1)'),
  parentChunkSizeFactor: z.coerce
    .number()
    .min(1)
    .describe('Parent size multiplier (parent = child * factor)'),
});

export type AppConfig = z.infer<typeof configSchema>;

function readConfig(): AppConfig {
  const raw = {
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    chromaUrl: process.env.CHROMA_URL,
    collectionName: process.env.COLLECTION_NAME,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL,
    geminiAskModel: process.env.GEMINI_ASK_MODEL,
    ragNResults: process.env.RAG_N_RESULTS,
    ragMinSimilarity: process.env.RAG_MIN_SIMILARITY,
    documentsDir: process.env.DOCUMENTS_DIR,
    sqliteDbPath: process.env.SQLITE_DB_PATH,
    childChunkSize: process.env.CHILD_CHUNK_SIZE,
    childChunkOverlapFactor: process.env.CHILD_CHUNK_OVERLAP_FACTOR,
    parentChunkSizeFactor: process.env.PARENT_CHUNK_SIZE_FACTOR,
  };

  try {
    const config = configSchema.parse(raw);
    logger.debug('Configuration validated successfully');
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed:');
      const errors = error.issues;
      for (let i = 0; i < errors.length; i++) {
        const err = errors[i];
        logger.error(`  - ${err.path.join('.')}: ${err.message}`);
      }
    }
    throw new Error('Invalid configuration. Check environment variables.');
  }
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = readConfig();
  }
  return cachedConfig;
}
