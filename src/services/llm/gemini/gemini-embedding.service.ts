import { GoogleGenAI } from '@google/genai';
import { LLMEmbeddingService } from '../llm.interface';
import { logger } from '../../../utils/logger';
import { GeminiModelSpecificConfig } from './gemini.service';

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

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('text is required and cannot be empty');
    }

    const resp = await this.genAI.models.embedContent({
      model: this.modelName,
      contents: [text],
    });

    if (!resp.embeddings || resp.embeddings.length === 0) {
      throw new Error('No embeddings returned from Gemini API');
    }

    const embedding = resp.embeddings[0];
    if (!embedding.values) {
      throw new Error('Embedding values are undefined');
    }

    return embedding.values;
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

    const resp = await this.genAI.models.embedContent({
      model: this.modelName,
      contents: texts,
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
}
