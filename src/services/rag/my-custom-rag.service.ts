import { logger } from '../../utils/logger';
import type { LLMAskingService, LLMEmbeddingService } from '../llm';
import type { ParentChunkDocumentStore } from '../parent-chunk-store';
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
  private parentChunkStore: ParentChunkDocumentStore;
  private nResults: number;
  private minSimilarity: number;

  private constructor(
    vectorDB: VectorDBService,
    embeddingService: LLMEmbeddingService,
    askingService: LLMAskingService,
    parentChunkStore: ParentChunkDocumentStore,
    nResults: number,
    minSimilarity: number,
  ) {
    this.vectorDB = vectorDB;
    this.embeddingService = embeddingService;
    this.askingService = askingService;
    this.parentChunkStore = parentChunkStore;
    this.nResults = nResults;
    this.minSimilarity = minSimilarity;
  }

  static create(
    vectorDB: VectorDBService,
    embeddingService: LLMEmbeddingService,
    askingService: LLMAskingService,
    parentChunkStore: ParentChunkDocumentStore,
    config: MyCustomRAGConfig,
  ): MyCustomRAGService {
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
      parentChunkStore,
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
    const childMatches = await this.vectorDB.query(
      questionEmbedding,
      this.nResults,
      this.minSimilarity,
    );

    if (childMatches.length === 0) {
      return NO_RESULTS_MESSAGE;
    }

    logger.debug(`Top child match similarity: ${childMatches[0].similarity}`);
    logger.debug(
      `Top child match doc substr(0, 30): ${childMatches[0].document.substring(0, 30)}`,
    );

    const parentBestSimilarity = new Map<number, number>();
    for (let i = 0; i < childMatches.length; i++) {
      const child = childMatches[i];
      const parentId = child.metadata.parentId as number;
      const existing = parentBestSimilarity.get(parentId);
      if (!existing || child.similarity > existing) {
        parentBestSimilarity.set(parentId, child.similarity);
      }
    }

    const parentIds = Array.from(parentBestSimilarity.keys());
    const parents = await this.parentChunkStore.getParents(parentIds);
    if (parents.length === 0) {
      return NO_RESULTS_MESSAGE;
    }

    logger.info(
      `Found ${childMatches.length} child matches from ${parents.length} unique parents`,
    );

    const sortedParents = parents.sort((a, b) => {
      const simA = parentBestSimilarity.get(a.id) ?? 0;
      const simB = parentBestSimilarity.get(b.id) ?? 0;
      return simB - simA;
    });

    const context = sortedParents
      .map((parent, i) => {
        const sim = parentBestSimilarity.get(parent.id) ?? 0;
        return `[Document ${i + 1}] (Best match: ${sim.toFixed(2)})\n${parent.content}`;
      })
      .join('\n\n');

    const prompt = this.buildPrompt(question, context);

    logger.debug(
      `Prompt: ${prompt}`
    );

    return this.askingService.ask(prompt);;
  }

  private buildPrompt(question: string, context: string): string {
    return PROMPT_TEMPLATE.replace('{context}', context).replace(
      '{question}',
      question,
    );
  }
}
