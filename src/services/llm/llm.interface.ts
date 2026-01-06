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
}

export interface LLMAskingService {
  /**
   * Generate an embedding vector for a single text input
   * @param prompt - prompt for asking ask
   * @returns answer
   */
  ask(prompt: string): Promise<string>;
}

export interface LLMService extends LLMAskingService, LLMEmbeddingService {}
