import { logger } from '../../../utils/logger';
import type { LLMEmbeddingService } from '../../llm';
import type { ParentChunkDocumentStore } from '../../parent-chunk-store';
import type { VectorDBService } from '../../vector-db';
import type { RetrievedContext, RetrieverService } from './retriever.interface';

export interface MyCustomRetrieverConfig {
  nResults: number;
  minSimilarity: number;
}

export class MyCustomRetrieverService implements RetrieverService {
  private vectorDB: VectorDBService;
  private embeddingService: LLMEmbeddingService;
  private parentChunkStore: ParentChunkDocumentStore;
  private nResults: number;
  private minSimilarity: number;

  private constructor(
    vectorDB: VectorDBService,
    embeddingService: LLMEmbeddingService,
    parentChunkStore: ParentChunkDocumentStore,
    nResults: number,
    minSimilarity: number,
  ) {
    this.vectorDB = vectorDB;
    this.embeddingService = embeddingService;
    this.parentChunkStore = parentChunkStore;
    this.nResults = nResults;
    this.minSimilarity = minSimilarity;
  }

  static create(
    vectorDB: VectorDBService,
    embeddingService: LLMEmbeddingService,
    parentChunkStore: ParentChunkDocumentStore,
    config: MyCustomRetrieverConfig,
  ): MyCustomRetrieverService {
    const { nResults, minSimilarity } = config;

    if (nResults <= 0) {
      throw new Error('nResults must be greater than 0');
    }

    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error('minSimilarity must be between 0 and 1');
    }

    logger.info('✓ Initialized Retriever service');

    return new MyCustomRetrieverService(
      vectorDB,
      embeddingService,
      parentChunkStore,
      nResults,
      minSimilarity,
    );
  }

  async retrieve(question: string): Promise<RetrievedContext> {
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
      return { entries: [] };
    }

    logger.debug(`Top child match similarity: ${childMatches[0].similarity}`);

    const parentBestSimilarity = new Map<number, number>();
    for (let i = 0; i < childMatches.length; i++) {
      const child = childMatches[i];
      const parentId = child.metadata.parentId as number;
      const existing = parentBestSimilarity.get(parentId);
      if (existing === undefined || child.similarity > existing) {
        parentBestSimilarity.set(parentId, child.similarity);
      }
    }

    const parentIds = Array.from(parentBestSimilarity.keys());
    const parents = await this.parentChunkStore.getParents(parentIds);

    if (parents.length === 0) {
      return { entries: [] };
    }

    logger.info(
      `Found ${childMatches.length} child matches from ${parents.length} unique parents`,
    );

    parents.sort((a, b) => {
      const simA = parentBestSimilarity.get(a.id) ?? 0;
      const simB = parentBestSimilarity.get(b.id) ?? 0;
      return simB - simA;
    });

    const entries = [];
    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      entries.push({
        sourceFile: parent.sourceFile,
        content: parent.content,
        similarity: parentBestSimilarity.get(parent.id) ?? 0,
      });
    }

    return { entries };
  }
}
