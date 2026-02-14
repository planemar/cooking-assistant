import { logger } from '../../utils/logger';
import type { LLMAskingService, LLMEmbeddingService } from '../llm';
import type { VectorDBService } from '../vector-db';
import type { RAGService } from './rag.interface';

const PROMPT_TEMPLATE = `You are a helpful cooking assistant that answers questions based on the provided recipes.

Context from user's cookbook:
{context}

User question: {question}

Instructions:
- Answer the question using only the information provided in the context above
- If the context doesn't contain enough information to answer the question, say so clearly
- Be concise and accurate
- Reference specific documents when applicable

Answer:`;

const NO_RESULTS_MESSAGE =
  'I could not find any relevant information in the cookbook to answer your question.';

export interface MyCustomRAGConfig {
  nResults: number;
  minSimilarity: number;
}

export class MyCustomRAGService implements RAGService {
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
    minSimilarity: number,
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
    config: MyCustomRAGConfig,
  ): RAGService {
    const { nResults, minSimilarity } = config;

    if (nResults <= 0) {
      throw new Error('nResults must be greater than 0');
    }

    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error('minSimilarity must be between 0 and 1');
    }

    logger.info('✓ Initialized RAG service with model');

    return new MyCustomRAGService(
      vectorDB,
      embeddingService,
      askingService,
      nResults,
      minSimilarity,
    );
  }

  async ask(question: string): Promise<string> {
    if (!question || question.trim() === '') {
      throw new Error('question is required and cannot be empty');
    }

    const questionEmbedding =
      await this.embeddingService.embedRetrievalQuery(question);
    const matches = await this.vectorDB.query(
      questionEmbedding,
      this.nResults,
      this.minSimilarity,
    );

    if (matches.length === 0) {
      return NO_RESULTS_MESSAGE;
    }

    logger.debug(`Top match simiarity: ${matches[0].similarity}`);
    logger.debug(
      `Top match doc substr(0, 30): ${matches[0].document.substring(0, 30)}`,
    );
    const context = matches
      .map(
        (match, index) =>
          `[Document ${index + 1}] (Similarity: ${match.similarity.toFixed(2)})\n${match.document}`,
      )
      .join('\n\n');

    const prompt = this.buildPrompt(question, context);
    const answer = await this.askingService.ask(prompt);

    return answer;
  }

  private buildPrompt(question: string, context: string): string {
    return PROMPT_TEMPLATE.replace('{context}', context).replace(
      '{question}',
      question,
    );
  }
}
