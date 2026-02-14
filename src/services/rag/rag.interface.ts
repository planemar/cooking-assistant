/**
 * Service interface for Retrieval-Augmented Generation
 * Combines vector search with LLM to answer questions based on retrieved context
 */
export interface RAGService {
  ask(question: string): Promise<string>;
}
