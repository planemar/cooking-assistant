import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config';
import { ParentChildChunkingService } from '../services/chunking';
import { GeminiEmbeddingService } from '../services/llm/gemini';
import type { LLMEmbeddingService } from '../services/llm/llm.interface';
import { SQLiteParentChunkStore } from '../services/parent-chunk-store';
import type { ParentChunkDocumentStore } from '../services/parent-chunk-store/parent-chunk-store.interface';
import { ChromaVectorDBService } from '../services/vector-db';
import type { VectorDBService } from '../services/vector-db/vector-db.interface';
import { logger } from '../utils/logger';
import { ParagraphSentenceChunker } from '../utils/text-chunker/paragraph-sentence-chunker';

const HASH_ALGORITHM = 'sha256';

interface FileInfo {
  filePath: string;
  fileName: string;
  content: string;
  hash: string;
}

function computeFileHash(content: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
}

async function readDocumentFiles(documentsDir: string): Promise<FileInfo[]> {
  const files = await fs.readdir(documentsDir);
  const txtFiles = files.filter((file) => file.endsWith('.txt'));

  const fileInfos: FileInfo[] = [];

  for (const fileName of txtFiles) {
    const filePath = path.join(documentsDir, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = computeFileHash(content);

    fileInfos.push({
      filePath,
      fileName,
      content: content.trim(),
      hash,
    });
  }

  return fileInfos;
}

/**
 * Core sync logic - testable by accepting all dependencies
 */
export async function syncDocumentsCore(
  deps: {
    vectorDB: VectorDBService;
    embeddingService: LLMEmbeddingService;
    chunkingService: ParentChildChunkingService;
    parentStore: ParentChunkDocumentStore;
    readFiles: (
      dir: string,
    ) => Promise<Array<{ fileName: string; content: string }>>;
    computeHash: (content: string) => string;
  },
  config: {
    documentsDir: string;
  },
  reset: boolean = false,
): Promise<void> {
  logger.info('Starting document synchronization...');
  logger.info(`Documents directory: ${config.documentsDir}`);

  if (reset) {
    logger.info('Reset flag detected - resetting both stores...');
    await deps.vectorDB.reset();
    await deps.parentStore.deleteAll();
    logger.info(
      'Reset complete. Collections will be recreated on next operation.',
    );
  }

  const currentFiles = await deps.readFiles(config.documentsDir);
  logger.info(`Found ${currentFiles.length} document file(s)`);

  const existingHashes = await deps.parentStore.getAllSourceFileHashes();
  const existingHashesMap = new Map(
    existingHashes.map((entry) => [entry.sourceFile, entry.hash]),
  );

  const filesToAdd: typeof currentFiles = [];
  const filesToUpdate: typeof currentFiles = [];
  const filesToDelete: string[] = [];

  for (let i = 0; i < currentFiles.length; i++) {
    const file = currentFiles[i];
    const hash = deps.computeHash(file.content);
    const existingHash = existingHashesMap.get(file.fileName);

    if (!existingHash) {
      filesToAdd.push(file);
    } else if (existingHash !== hash) {
      filesToUpdate.push(file);
    }

    existingHashesMap.delete(file.fileName);
  }

  for (const [sourceFile] of existingHashesMap) {
    filesToDelete.push(sourceFile);
  }

  logger.info(`Documents to add: ${filesToAdd.length}`);
  logger.info(`Documents to update: ${filesToUpdate.length}`);
  logger.info(`Documents to delete: ${filesToDelete.length}`);

  if (filesToDelete.length > 0) {
    logger.info('Deleting removed documents...');
    for (let i = 0; i < filesToDelete.length; i++) {
      const sourceFile = filesToDelete[i];
      await deps.parentStore.deleteBySourceFile(sourceFile);
      await deps.vectorDB.deleteDocuments({ where: { sourceFile } });
    }
    logger.info(`✓ Deleted ${filesToDelete.length} document(s)`);
  }

  if (filesToAdd.length > 0) {
    logger.info('Adding new documents...');
    await processFiles(filesToAdd, deps);
    logger.info(`✓ Added ${filesToAdd.length} document(s)`);
  }

  if (filesToUpdate.length > 0) {
    logger.info('Updating modified documents...');
    for (let i = 0; i < filesToUpdate.length; i++) {
      const file = filesToUpdate[i];
      await deps.parentStore.deleteBySourceFile(file.fileName);
      await deps.vectorDB.deleteDocuments({
        where: { sourceFile: file.fileName },
      });
    }
    await processFiles(filesToUpdate, deps);
    logger.info(`✓ Updated ${filesToUpdate.length} document(s)`);
  }

  logger.info('✓ Document synchronization complete!');
}

/**
 * Helper function to process files and insert parent/child chunks
 */
async function processFiles(
  files: Array<{ fileName: string; content: string }>,
  deps: {
    chunkingService: ParentChildChunkingService;
    embeddingService: LLMEmbeddingService;
    parentStore: ParentChunkDocumentStore;
    vectorDB: VectorDBService;
    computeHash: (content: string) => string;
  },
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const chunks = deps.chunkingService.chunk(file.content);

    if (chunks.length === 0) {
      logger.warn(`File ${file.fileName} produced no chunks, skipping`);
      continue;
    }

    const hash = deps.computeHash(file.content);
    const syncedAt = Date.now();

    const parentRecords = chunks.map((chunk, parentIndex) => ({
      sourceFile: file.fileName,
      parentIndex,
      content: chunk.text,
      hash,
      syncedAt,
    }));

    const parentIds = await deps.parentStore.insertParents(parentRecords);

    const allChildDocs = [];
    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      const parentId = parentIds[j];
      const parentIndex = j;

      for (let k = 0; k < chunk.children.length; k++) {
        const childText = chunk.children[k];
        const childId = `chunk:${file.fileName}:${parentId}:${k}`;

        allChildDocs.push({
          id: childId,
          document: childText,
          metadata: {
            sourceFile: file.fileName,
            parentId,
            parentIndex,
            childIndex: k,
            hash,
            syncedAt,
          },
        });
      }
    }

    const childTexts = allChildDocs.map((doc) => doc.document);
    const embeddings =
      await deps.embeddingService.embedBatchRetrievalDocument(childTexts);

    const documentsWithEmbeddings = allChildDocs.map((doc, index) => ({
      ...doc,
      embedding: embeddings[index],
    }));

    await deps.vectorDB.addDocuments(documentsWithEmbeddings);
  }
}

async function syncDocuments(reset: boolean = false): Promise<void> {
  const config = getConfig();
  const documentsDir = path.resolve(config.documentsDir);

  const vectorDB = await ChromaVectorDBService.create({
    collectionName: config.collectionName,
    chromaUrl: config.chromaUrl,
  });

  const embeddingService = GeminiEmbeddingService.create({
    apiKey: config.geminiApiKey,
    modelName: config.geminiEmbeddingModel,
  });

  const textChunker = new ParagraphSentenceChunker();
  const chunkingService = ParentChildChunkingService.create(textChunker, {
    childChunkSize: config.childChunkSize,
    childChunkOverlapFactor: config.childChunkOverlapFactor,
    parentChunkSizeFactor: config.parentChunkSizeFactor,
  });

  const parentStore = SQLiteParentChunkStore.create({
    dbPath: config.sqliteDbPath,
  });

  const readFilesAdapter = async (dir: string) => {
    const files = await readDocumentFiles(dir);
    return files.map((f) => ({ fileName: f.fileName, content: f.content }));
  };

  const computeHashAdapter = (content: string) => {
    return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
  };

  try {
    await syncDocumentsCore(
      {
        vectorDB,
        embeddingService,
        chunkingService,
        parentStore,
        readFiles: readFilesAdapter,
        computeHash: computeHashAdapter,
      },
      {
        documentsDir,
      },
      reset,
    );
  } finally {
    await parentStore.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const resetFlag = args.includes('--reset') || args.includes('-r');

  syncDocuments(resetFlag).catch((error) => {
    logger.error(
      'Error during document synchronization',
      error instanceof Error ? error : undefined,
    );
    process.exit(1);
  });
}
