/**
 * Service interface for Retrieval-Augmented Generation
 * Combines vector search with LLM to answer questions based on retrieved context
 */
export interface RAGService {
  /**
   * Answer a question using retrieved context from the vector database
   * @param question - User's question
   * @returns LLM-generated answer based on retrieved context
   */
  ask(question: string): Promise<string>;
}