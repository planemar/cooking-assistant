import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ChromaVectorDBService } from '../services/vector-db';
import { GeminiEmbeddingService } from '../services/llm/gemini';
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

  // TODO: read and validate conf in a separate object
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

  if (!process.env.DOCUMENTS_DIR || process.env.DOCUMENTS_DIR.trim() === '') {
    throw new Error('DOCUMENTS_DIR environment variable is required');
  }

  const documentsDir = path.resolve(process.env.DOCUMENTS_DIR);
  logger.info(`Documents directory: ${documentsDir}`);

  const vectorDB = await ChromaVectorDBService.create({
    collectionName: process.env.COLLECTION_NAME,
    chromaUrl: process.env.CHROMA_URL,
  });

  if (reset) {
    logger.info('Reset flag detected - resetting ChromaDB instance...');
    await vectorDB.reset();
    logger.info('ChromaDB reset complete. Collection will be recreated on next operation.');
  }

  const embeddingService = GeminiEmbeddingService.create({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: process.env.GEMINI_EMBEDDING_MODEL,
  });

  const currentFiles = await readDocumentFiles(documentsDir);
  logger.info(`Found ${currentFiles.length} document file(s)`);

  if (currentFiles.length === 0) {
    logger.info('No documents to sync');
    return;
  }

  const existingDocs = await vectorDB.getAllDocumentInfo();
  const existingDocsMap = new Map(existingDocs.map((doc) => [doc.id, doc.metadata.hash]));

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
    await vectorDB.deleteDocuments(toDelete);
    logger.info(`✓ Deleted ${toDelete.length} document(s)`);
  }

  if (toAdd.length > 0) {
    logger.info('Adding new documents...');
    const texts = toAdd.map((f) => f.content);
    const embeddings = await embeddingService.embedBatchRetrievalDocument(texts);

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
      }))
    );
    logger.info(`✓ Added ${toAdd.length} document(s)`);
  }

  if (toUpdate.length > 0) {
    logger.info('Updating modified documents...');
    const texts = toUpdate.map((f) => f.content);
    const embeddings = await embeddingService.embedBatchRetrievalDocument(texts);

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
      }))
    );
    logger.info(`✓ Updated ${toUpdate.length} document(s)`);
  }

  logger.info('✓ Document synchronization complete!');
}

// Parse command line arguments (skip first 2 elements: node executable and script path)
const args = process.argv.slice(2);
const resetFlag = args.includes('--reset') || args.includes('-r');

syncDocuments(resetFlag).catch((error) => {
  logger.error('Error during document synchronization', error instanceof Error ? error : undefined);
  process.exit(1);
});