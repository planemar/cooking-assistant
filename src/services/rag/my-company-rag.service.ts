import { VectorDBService } from '../vector-db';
import { LLMAskingService, LLMEmbeddingService, LLMService } from '../llm';
import { RAGService } from './rag.interface';
import { logger } from '../../utils/logger';

const PROMPT_TEMPLATE = `You are a helpful assistant that answers questions based on the provided company documentation.

Context from company guides:
{context}

User question: {question}

Instructions:
- Answer the question using only the information provided in the context above
- If the context doesn't contain enough information to answer the question, say so clearly
- Be concise and accurate
- Reference specific documents when applicable

Answer:`;

const NO_RESULTS_MESSAGE = 'I could not find any relevant information in the company guides to answer your question.';

export interface MyCompanyRAGConfig {
  /** Number of documents to retrieve for context */
  nResults: number;

  /** Minimum similarity threshold for retrieved documents (0-1) */
  minSimilarity: number;
}

export class MyCompanyRAGService implements RAGService {
  private vectorDB: VectorDBService;
  private embeddingService: LLMEmbeddingService;
  private askingService: LLMAskingService;
  private nResults: number;
  private minSimilarity: number;

  private constructor(
    vectorDB: VectorDBService,
    embeddingService: LLMEmbeddingService,
    askingService: LLMAskingService,
    nResults: number,
    minSimilarity: number
  ) {
    this.vectorDB = vectorDB;
    this.embeddingService = embeddingService;
    this.askingService = askingService;
    this.nResults = nResults;
    this.minSimilarity = minSimilarity;
  }

  static create(
    vectorDB: VectorDBService,
    embeddingService: LLMEmbeddingService,
    askingService: LLMAskingService,
    config: MyCompanyRAGConfig
  ): RAGService {
    const { nResults, minSimilarity } = config;

    if (nResults <= 0) {
      throw new Error('nResults must be greater than 0');
    }

    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error('minSimilarity must be between 0 and 1');
    }

    logger.info('✓ Initialized RAG service with model');

    return new MyCompanyRAGService(vectorDB, embeddingService, askingService, nResults, minSimilarity);
  }

  async ask(question: string): Promise<string> {
    if (!question || question.trim() === '') {
      throw new Error('question is required and cannot be empty');
    }

    const questionEmbedding = await this.embeddingService.embed(question);
    logger.debug(`Question embedding: ${questionEmbedding.toString()}`);
    const matches = await this.vectorDB.query(questionEmbedding, this.nResults, this.minSimilarity);

    if (matches.length === 0) {
      return NO_RESULTS_MESSAGE;
    }

    const context = matches
      .map((match, index) => `[Document ${index + 1}] (Similarity: ${match.similarity.toFixed(2)})\n${match.document}`)
      .join('\n\n');
    logger.debug(`Prompt context: ${context}`);

    const prompt = this.buildPrompt(question, context);
    const answer = await this.askingService.ask(prompt);

    return answer;
  }

  private buildPrompt(question: string, context: string): string {
    return PROMPT_TEMPLATE.replace('{context}', context).replace('{question}', question);
  }
}
