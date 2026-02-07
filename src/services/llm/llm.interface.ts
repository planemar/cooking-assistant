export interface LLMEmbeddingService {
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

  /**
   * Generate an embedding optimized for retrieval queries
   * @param text - Query text to embed
   * @returns Embedding vector
   */
  embedRetrievalQuery(text: string): Promise<number[]>;

  /**
   * Generate an embedding optimized for documents to be retrieved
   * @param text - Document text to embed
   * @returns Embedding vector
   */
  embedRetrievalDocument(text: string): Promise<number[]>;

  /**
   * Generate embeddings optimized for retrieval documents in batch
   * @param texts - Array of document texts to embed
   * @returns Array of embedding vectors
   */
  embedBatchRetrievalDocument(texts: string[]): Promise<number[][]>;
}

export interface LLMAskingService {
  /**
   * @param prompt - prompt for asking ask
   * @returns answer
   */
  ask(prompt: string): Promise<string>;
}

export interface LLMService extends LLMAskingService, LLMEmbeddingService { }
