/**
 * Represents a document with its embedding and metadata
 */
export interface VectorDocument {
  id: string;
  embedding: number[];
  document: string;
  metadata: Record<string, any>;
}

/**
 * Represents a document retrieved from the database
 */
export interface StoredDocument {
  id: string;
  document: string;
  metadata: Record<string, any>;
}

/**
 * Represents a query result with similarity score
 */
export interface QueryMatch extends StoredDocument {
  similarity: number;
}

/**
 * Lightweight document info for syncing purposes
 */
export interface DocumentInfo {
  id: string;
  metadata: Record<string, any>;
}

/**
 * Service interface for vector database operations
 * Provides abstraction over vector database implementations
 */
export interface VectorDBService {
  addDocuments(documents: VectorDocument[]): Promise<void>;
  updateDocuments(documents: VectorDocument[]): Promise<void>;
  deleteDocuments(params: {
    ids?: string[];
    where?: Record<string, any>;
  }): Promise<void>;

  /**
   * Query the vector database for similar documents
   * @param queryEmbedding - Vector embedding of the query
   * @param nResults - Maximum number of results to return
   * @param minSimilarity - Minimum similarity threshold (0-1, higher = more similar)
   * @returns Array of matching documents with similarity scores above threshold
   */
  query(
    queryEmbedding: number[],
    nResults: number,
    minSimilarity: number,
  ): Promise<QueryMatch[]>;

  getDocument(id: string): Promise<StoredDocument | null>;
  getAllDocumentInfo(): Promise<DocumentInfo[]>;
  reset(): Promise<void>;
}
