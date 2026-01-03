import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ChromaVectorDBService } from '../services/vector-db';
import { GeminiEmbeddingService } from '../services/embedding';

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

async function syncDocuments(): Promise<void> {
  console.log('Starting document synchronization...\n');

  if (!process.env.COLLECTION_NAME || process.env.COLLECTION_NAME.trim() === '') {
    throw new Error('COLLECTION_NAME environment variable is required');
  }

  if (!process.env.CHROMA_PATH || process.env.CHROMA_PATH.trim() === '') {
    throw new Error('CHROMA_PATH environment variable is required');
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
  console.log(`Documents directory: ${documentsDir}\n`);

  const vectorDB = await ChromaVectorDBService.create({
    collectionName: process.env.COLLECTION_NAME,
    chromaPath: process.env.CHROMA_PATH,
  });

  const embeddingService = GeminiEmbeddingService.create({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: process.env.GEMINI_EMBEDDING_MODEL,
  });

  const currentFiles = await readDocumentFiles(documentsDir);
  console.log(`Found ${currentFiles.length} document file(s)\n`);

  if (currentFiles.length === 0) {
    console.log('No documents to sync');
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

  console.log(`Documents to add: ${toAdd.length}`);
  console.log(`Documents to update: ${toUpdate.length}`);
  console.log(`Documents to delete: ${toDelete.length}\n`);

  if (toDelete.length > 0) {
    console.log('Deleting removed documents...');
    await vectorDB.deleteDocuments(toDelete);
    console.log(`✓ Deleted ${toDelete.length} document(s)\n`);
  }

  if (toAdd.length > 0) {
    console.log('Adding new documents...');
    const texts = toAdd.map((f) => f.content);
    const embeddings = await embeddingService.embedBatch(texts);

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
    console.log(`✓ Added ${toAdd.length} document(s)\n`);
  }

  if (toUpdate.length > 0) {
    console.log('Updating modified documents...');
    const texts = toUpdate.map((f) => f.content);
    const embeddings = await embeddingService.embedBatch(texts);

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
    console.log(`✓ Updated ${toUpdate.length} document(s)\n`);
  }

  console.log('✓ Document synchronization complete!');
}

syncDocuments().catch((error) => {
  console.error('Error during document synchronization:', error);
  process.exit(1);
});