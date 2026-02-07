import { GoogleGenAI } from '@google/genai';
import { LLMEmbeddingService } from '../llm.interface';
import { logger } from '../../../utils/logger';
import { GeminiModelSpecificConfig } from './gemini.service';

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

  static create(config: GeminiModelSpecificConfig): LLMEmbeddingService {
    const { apiKey, modelName } = config;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('apiKey is required and cannot be empty');
    }

    if (!modelName || modelName.trim() === '') {
      throw new Error('modelName is required and cannot be empty');
    }

    const genAI = new GoogleGenAI({ apiKey });

    logger.info('✓ Initialized Gemini embedding service');

    return new GeminiEmbeddingService(genAI, modelName);
  }

  // TODO: max batch size is 100, need to split texts
  private async embedBatchWithTaskType(texts: string[], taskType: GeminiTaskType): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim() === '') {
        throw new Error(`text at index ${i} is required and cannot be empty`);
      }
    }

    const resp = await this.genAI.models.embedContent({
      model: this.modelName,
      contents: texts,
      config: {
        taskType,
      },
    });

    if (!resp.embeddings) {
      throw new Error('No embeddings returned from Gemini API');
    }

    return resp.embeddings.map((embedding) => {
      if (!embedding.values) {
        throw new Error('Embedding values are undefined');
      }
      return embedding.values;
    });
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

  private async embedWithTaskType(text: string, taskType: GeminiTaskType): Promise<number[]> {
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
