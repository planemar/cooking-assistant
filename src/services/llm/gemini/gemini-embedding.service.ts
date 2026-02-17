import { GoogleGenAI } from '@google/genai';
import { logger } from '../../../utils/logger';
import type { LLMEmbeddingService } from '../llm.interface';
import type { GeminiModelSpecificConfig } from './gemini.service';

const MAX_BATCH_SIZE = 100;
const EMBEDDING_TIMEOUT_MS = 30000;

type GeminiTaskType =
  | 'TASK_TYPE_UNSPECIFIED'
  | 'RETRIEVAL_QUERY'
  | 'RETRIEVAL_DOCUMENT'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING'
  | 'QUESTION_ANSWERING'
  | 'FACT_VERIFICATION'
  | 'CODE_RETRIEVAL_QUERY';

export class GeminiEmbeddingService implements LLMEmbeddingService {
  private genAI: GoogleGenAI;
  private modelName: string;

  private constructor(genAI: GoogleGenAI, modelName: string) {
    this.genAI = genAI;
    this.modelName = modelName;
  }

  static create(config: GeminiModelSpecificConfig): GeminiEmbeddingService {
    const { apiKey, modelName } = config;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('apiKey is required and cannot be empty');
    }

    if (!modelName || modelName.trim() === '') {
      throw new Error('modelName is required and cannot be empty');
    }

    const genAI = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: EMBEDDING_TIMEOUT_MS },
    });

    logger.info('✓ Initialized Gemini embedding service');

    return new GeminiEmbeddingService(genAI, modelName);
  }

  private async embedBatchWithTaskType(
    texts: string[],
    taskType: GeminiTaskType,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim() === '') {
        throw new Error(`text at index ${i} is required and cannot be empty`);
      }
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);

      const resp = await this.genAI.models.embedContent({
        model: this.modelName,
        contents: batch,
        config: {
          taskType,
        },
      });

      if (!resp.embeddings) {
        throw new Error('No embeddings returned from Gemini API');
      }

      for (let j = 0; j < resp.embeddings.length; j++) {
        const values = resp.embeddings[j].values;
        if (!values) {
          throw new Error('Embedding values are undefined');
        }
        results.push(values);
      }
    }

    return results;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.embedBatchWithTaskType(texts, 'TASK_TYPE_UNSPECIFIED');
  }

  async embedBatchRetrievalDocument(texts: string[]): Promise<number[][]> {
    return this.embedBatchWithTaskType(texts, 'RETRIEVAL_DOCUMENT');
  }

  async embedBatchRetrievalQuery(texts: string[]): Promise<number[][]> {
    return this.embedBatchWithTaskType(texts, 'RETRIEVAL_QUERY');
  }

  async embedBatchSemanticSimilarity(texts: string[]): Promise<number[][]> {
    return this.embedBatchWithTaskType(texts, 'SEMANTIC_SIMILARITY');
  }

  private async embedWithTaskType(
    text: string,
    taskType: GeminiTaskType,
  ): Promise<number[]> {
    const res = await this.embedBatchWithTaskType([text], taskType);
    if (res.length === 0) {
      throw new Error('No embeddings returned from Gemini API');
    }

    return res[0];
  }

  async embed(text: string): Promise<number[]> {
    return this.embedWithTaskType(text, 'TASK_TYPE_UNSPECIFIED');
  }

  async embedRetrievalQuery(text: string): Promise<number[]> {
    return this.embedWithTaskType(text, 'RETRIEVAL_QUERY');
  }

  async embedRetrievalDocument(text: string): Promise<number[]> {
    return this.embedWithTaskType(text, 'RETRIEVAL_DOCUMENT');
  }

  async embedSemanticSimilarity(text: string): Promise<number[]> {
    return this.embedWithTaskType(text, 'SEMANTIC_SIMILARITY');
  }
}
