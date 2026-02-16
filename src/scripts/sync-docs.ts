import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config';
import { GeminiEmbeddingService } from '../services/llm/gemini';
import { ChromaVectorDBService } from '../services/vector-db';
import { logger } from '../utils/logger';

const HASH_ALGORITHM = 'sha256';

interface FileInfo {
  filePath: string;
  fileName: string;
  content: string;
  hash: string;
}

async function computeFileHash(content: string): Promise<string> {
  return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
}

async function readDocumentFiles(documentsDir: string): Promise<FileInfo[]> {
  const files = await fs.readdir(documentsDir);
  const txtFiles = files.filter((file) => file.endsWith('.txt'));

  const fileInfos: FileInfo[] = [];

  for (const fileName of txtFiles) {
    const filePath = path.join(documentsDir, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = await computeFileHash(content);

    fileInfos.push({
      filePath,
      fileName,
      content: content.trim(),
      hash,
    });
  }

  return fileInfos;
}

async function syncDocuments(reset: boolean = false): Promise<void> {
  logger.info('Starting document synchronization...');

  const config = getConfig();

  const documentsDir = path.resolve(config.documentsDir);
  logger.info(`Documents directory: ${documentsDir}`);

  const vectorDB = await ChromaVectorDBService.create({
    collectionName: config.collectionName,
    chromaUrl: config.chromaUrl,
  });

  if (reset) {
    logger.info('Reset flag detected - resetting ChromaDB instance...');
    await vectorDB.reset();
    logger.info(
      'ChromaDB reset complete. Collection will be recreated on next operation.',
    );
  }

  const embeddingService = GeminiEmbeddingService.create({
    apiKey: config.geminiApiKey,
    modelName: config.geminiEmbeddingModel,
  });

  const currentFiles = await readDocumentFiles(documentsDir);
  logger.info(`Found ${currentFiles.length} document file(s)`);

  if (currentFiles.length === 0) {
    logger.info('No documents to sync');
    return;
  }

  const existingDocs = await vectorDB.getAllDocumentInfo();
  const existingDocsMap = new Map(
    existingDocs.map((doc) => [doc.id, doc.metadata.hash]),
  );

  const toAdd: FileInfo[] = [];
  const toUpdate: FileInfo[] = [];
  const toDelete: string[] = [];

  for (const file of currentFiles) {
    const docId = file.fileName;
    const existingHash = existingDocsMap.get(docId);

    if (!existingHash) {
      toAdd.push(file);
    } else if (existingHash !== file.hash) {
      toUpdate.push(file);
    }

    existingDocsMap.delete(docId);
  }

  toDelete.push(...existingDocsMap.keys());

  logger.info(`Documents to add: ${toAdd.length}`);
  logger.info(`Documents to update: ${toUpdate.length}`);
  logger.info(`Documents to delete: ${toDelete.length}`);

  if (toDelete.length > 0) {
    logger.info('Deleting removed documents...');
    await vectorDB.deleteDocuments({ ids: toDelete });
    logger.info(`✓ Deleted ${toDelete.length} document(s)`);
  }

  if (toAdd.length > 0) {
    logger.info('Adding new documents...');
    const texts = toAdd.map((f) => f.content);
    const embeddings =
      await embeddingService.embedBatchRetrievalDocument(texts);

    await vectorDB.addDocuments(
      toAdd.map((file, index) => ({
        id: file.fileName,
        embedding: embeddings[index],
        document: file.content,
        metadata: {
          fileName: file.fileName,
          hash: file.hash,
          addedAt: new Date().toISOString(),
        },
      })),
    );
    logger.info(`✓ Added ${toAdd.length} document(s)`);
  }

  if (toUpdate.length > 0) {
    logger.info('Updating modified documents...');
    const texts = toUpdate.map((f) => f.content);
    const embeddings =
      await embeddingService.embedBatchRetrievalDocument(texts);

    await vectorDB.updateDocuments(
      toUpdate.map((file, index) => ({
        id: file.fileName,
        embedding: embeddings[index],
        document: file.content,
        metadata: {
          fileName: file.fileName,
          hash: file.hash,
          updatedAt: new Date().toISOString(),
        },
      })),
    );
    logger.info(`✓ Updated ${toUpdate.length} document(s)`);
  }

  logger.info('✓ Document synchronization complete!');
}

const args = process.argv.slice(2);
const resetFlag = args.includes('--reset') || args.includes('-r');

syncDocuments(resetFlag).catch((error) => {
  logger.error(
    'Error during document synchronization',
    error instanceof Error ? error : undefined,
  );
  process.exit(1);
});
