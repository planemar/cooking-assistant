import { GoogleGenAI } from '@google/genai';
import { EmbeddingService } from './embedding.interface';
import { logger } from '../../utils/logger';

export interface GeminiEmbeddingConfig {
  /** Gemini API key */
  apiKey: string;

  /** Model name for embeddings */
  modelName: string;
}

export class GeminiEmbeddingService implements EmbeddingService {
  private genAI: GoogleGenAI;
  private modelName: string;

  private constructor(genAI: GoogleGenAI, modelName: string) {
    this.genAI = genAI;
    this.modelName = modelName;
  }

  static create(config: GeminiEmbeddingConfig): GeminiEmbeddingService {
    const { apiKey, modelName } = config;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('apiKey is required and cannot be empty');
    }

    if (!modelName || modelName.trim() === '') {
      throw new Error('modelName is required and cannot be empty');
    }

    const genAI = new GoogleGenAI({ apiKey });

    logger.info(`✓ Initialized Gemini embedding service with model: ${modelName}`);

    return new GeminiEmbeddingService(genAI, modelName);
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('text is required and cannot be empty');
    }

    const result = await this.genAI.models.embedContent({
      model: this.modelName,
      content: text,
    });

    return result.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim() === '') {
        throw new Error(`text at index ${i} is required and cannot be empty`);
      }
    }

    const embeddings: number[][] = [];

    for (const text of texts) {
      const result = await this.genAI.models.embedContent({
        model: this.modelName,
        content: text,
      });
      embeddings.push(result.values);
    }

    return embeddings;
  }
}