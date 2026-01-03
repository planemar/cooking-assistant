/**
 * Represents a document with its embedding and metadata
 */
export interface VectorDocument {
  /** Unique identifier for the document */
  id: string;

  /** Vector embedding representation of the document */
  embedding: number[];

  /** Text content of the document */
  document: string;

  /** Additional metadata (e.g., filename, hash, timestamp) */
  metadata: Record<string, any>;
}

/**
 * Represents a document retrieved from the database
 */
export interface StoredDocument {
  /** Unique identifier for the document */
  id: string;

  /** Text content of the document */
  document: string;

  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Represents a query result with similarity score
 */
export interface QueryMatch extends StoredDocument {
  /** Similarity score (higher = more similar) */
  similarity: number;
}

/**
 * Lightweight document info for syncing purposes
 */
export interface DocumentInfo {
  /** Unique identifier for the document */
  id: string;

  /** Metadata only (contains hash for sync checking) */
  metadata: Record<string, any>;
}

/**
 * Service interface for vector database operations
 * Provides abstraction over vector database implementations
 */
export interface VectorDBService {
  /**
   * Add new documents to the vector database
   * @param documents - Array of documents with embeddings and metadata
   */
  addDocuments(documents: VectorDocument[]): Promise<void>;

  /**
   * Update existing documents in the vector database
   * @param documents - Array of documents to update
   */
  updateDocuments(documents: VectorDocument[]): Promise<void>;

  /**
   * Delete documents from the vector database
   * @param ids - Unique identifiers of documents to delete
   */
  deleteDocuments(ids: string[]): Promise<void>;

  /**
   * Query the vector database for similar documents
   * @param queryEmbedding - Vector embedding of the query
   * @param nResults - Maximum number of results to return
   * @param minSimilarity - Minimum similarity threshold (0-1, higher = more similar)
   * @returns Array of matching documents with similarity scores above threshold
   */
  query(queryEmbedding: number[], nResults: number, minSimilarity: number): Promise<QueryMatch[]>;

  /**
   * Get a specific document by its ID
   * @param id - Unique identifier of the document
   * @returns Document data or null if not found
   */
  getDocument(id: string): Promise<StoredDocument | null>;

  /**
   * Get all document IDs and metadata (lightweight, for sync operations)
   * @returns Array of document IDs with metadata
   */
  getAllDocumentInfo(): Promise<DocumentInfo[]>;
}