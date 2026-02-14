import { ChromaClient, type Collection } from 'chromadb';
import { logger } from '../../utils/logger';
import type {
  DocumentInfo,
  QueryMatch,
  StoredDocument,
  VectorDBService,
  VectorDocument,
} from './vector-db.interface';

export interface ChromaDBConfig {
  chromaUrl: string;
  collectionName: string;
}

export class ChromaVectorDBService implements VectorDBService {
  private client: ChromaClient;
  private collection: Collection;
  private collectionName: string;

  private constructor(
    client: ChromaClient,
    collection: Collection,
    collectionName: string,
  ) {
    this.client = client;
    this.collection = collection;
    this.collectionName = collectionName;
  }

  private static getCollectionMetadata() {
    return { 'hnsw:space': 'cosine' };
  }

  static async create(config: ChromaDBConfig): Promise<VectorDBService> {
    const { collectionName, chromaUrl } = config;

    if (!collectionName || collectionName.trim() === '') {
      throw new Error('collectionName is required and cannot be empty');
    }

    if (!chromaUrl || chromaUrl.trim() === '') {
      throw new Error('chromaUrl is required and cannot be empty');
    }

    const url = new URL(chromaUrl);
    if (!url.port) {
      throw new Error(
        'chromaUrl must include a port (e.g., http://localhost:8000)',
      );
    }

    const port = parseInt(url.port, 10);
    if (Number.isNaN(port)) {
      throw new Error('chromaUrl port must be a valid number');
    }

    const client = new ChromaClient({
      host: url.hostname,
      port: port,
    });

    try {
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        metadata: ChromaVectorDBService.getCollectionMetadata(),
      });
      logger.info(`✓ Connected to collection: ${collectionName}`);

      return new ChromaVectorDBService(client, collection, collectionName);
    } catch (error) {
      logger.error(
        'Failed to initialize ChromaDB',
        error instanceof Error ? error : undefined,
      );
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

  async query(
    queryEmbedding: number[],
    nResults: number,
    minSimilarity: number,
  ): Promise<QueryMatch[]> {
    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error('minSimilarity must be between 0 and 1');
    }

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
    });

    const matches: QueryMatch[] = [];

    if (
      results.ids[0] &&
      results.documents[0] &&
      results.metadatas[0] &&
      results.distances[0]
    ) {
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

    if (
      results.ids.length === 0 ||
      !results.documents[0] ||
      !results.metadatas[0]
    ) {
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

  async reset(): Promise<void> {
    await this.client.deleteCollection({ name: this.collectionName });
    logger.info(`✓ Collection '${this.collectionName}' deleted`);

    this.collection = await this.client.createCollection({
      name: this.collectionName,
      metadata: ChromaVectorDBService.getCollectionMetadata(),
    });
    logger.info(`✓ Collection '${this.collectionName}' recreated`);
  }
}
