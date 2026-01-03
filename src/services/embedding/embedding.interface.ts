/**
 * Service interface for generating text embeddings
 * Provides abstraction over embedding model providers
 */
export interface EmbeddingService {
  /**
   * Generate an embedding vector for a single text input
   * @param text - Text content to embed
   * @returns Embedding vector
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embedding vectors for multiple text inputs
   * @param texts - Array of text content to embed
   * @returns Array of embedding vectors
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}