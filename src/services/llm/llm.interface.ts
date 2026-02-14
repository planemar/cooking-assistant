export interface LLMEmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  embedRetrievalQuery(text: string): Promise<number[]>;
  embedRetrievalDocument(text: string): Promise<number[]>;
  embedBatchRetrievalDocument(texts: string[]): Promise<number[][]>;
}

export interface LLMAskingService {
  ask(prompt: string): Promise<string>;
}

export interface LLMService extends LLMAskingService, LLMEmbeddingService {}
