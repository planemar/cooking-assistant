import { ChromaClient, Collection } from 'chromadb';
import path from 'path';
import {
  VectorDBService,
  VectorDocument,
  StoredDocument,
  QueryMatch,
  DocumentInfo,
} from './vector-db.interface';
import { logger } from '../../utils/logger';

export interface ChromaDBConfig {
  /** Path to ChromaDB storage directory */
  chromaPath: string;

  /** Name of the collection to use */
  collectionName: string;
}

export class ChromaVectorDBService implements VectorDBService {
  private collection: Collection;

  private constructor(collection: Collection) {
    this.collection = collection;
  }

  static async create(config: ChromaDBConfig): Promise<ChromaVectorDBService> {
    const { collectionName, chromaPath } = config;

    if (!collectionName || collectionName.trim() === '') {
      throw new Error('collectionName is required and cannot be empty');
    }

    if (!chromaPath || chromaPath.trim() === '') {
      throw new Error('chromaPath is required and cannot be empty');
    }

    const client = new ChromaClient({
      path: path.resolve(chromaPath),
    });

    try {
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        metadata: { description: 'Company guides and documentation' },
      });
      logger.info(`✓ Connected to collection: ${collectionName}`);

      return new ChromaVectorDBService(collection);
    } catch (error) {
      logger.error('Failed to initialize ChromaDB', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.collection.add({
      ids: documents.map((d) => d.id),
      embeddings: documents.map((d) => d.embedding),
      documents: documents.map((d) => d.document),
      metadatas: documents.map((d) => d.metadata),
    });
  }

  async updateDocuments(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.collection.update({
      ids: documents.map((d) => d.id),
      embeddings: documents.map((d) => d.embedding),
      documents: documents.map((d) => d.document),
      metadatas: documents.map((d) => d.metadata),
    });
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.collection.delete({
      ids,
    });
  }

  async query(queryEmbedding: number[], nResults: number, minSimilarity: number): Promise<QueryMatch[]> {
    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error('minSimilarity must be between 0 and 1');
    }

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
    });

    const matches: QueryMatch[] = [];

    if (results.ids[0] && results.documents[0] && results.metadatas[0] && results.distances[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i];
        const document = results.documents[0][i];
        const metadata = results.metadatas[0][i];
        const distance = results.distances[0][i];

        if (id && document && metadata !== null && distance !== null) {
          const similarity = 1 - distance;

          if (similarity >= minSimilarity) {
            matches.push({
              id,
              document,
              metadata,
              similarity,
            });
          }
        }
      }
    }

    return matches;
  }

  async getDocument(id: string): Promise<StoredDocument | null> {
    const results = await this.collection.get({
      ids: [id],
    });

    if (results.ids.length === 0 || !results.documents[0] || !results.metadatas[0]) {
      return null;
    }

    return {
      id: results.ids[0],
      document: results.documents[0],
      metadata: results.metadatas[0],
    };
  }

  async getAllDocumentInfo(): Promise<DocumentInfo[]> {
    const results = await this.collection.get({
      include: ['metadatas'],
    });

    const documentInfos: DocumentInfo[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      const id = results.ids[i];
      const metadata = results.metadatas[i];

      if (id && metadata !== null) {
        documentInfos.push({
          id,
          metadata,
        });
      }
    }

    return documentInfos;
  }
}