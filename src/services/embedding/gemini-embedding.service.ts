import { GoogleGenerativeAI, GenerativeModel } from '@google/genai';
import { EmbeddingService } from './embedding.interface';

export interface GeminiEmbeddingConfig {
  /** Gemini API key */
  apiKey: string;

  /** Model name for embeddings */
  modelName: string;
}

export class GeminiEmbeddingService implements EmbeddingService {
  private model: GenerativeModel;

  private constructor(model: GenerativeModel) {
    this.model = model;
  }

  static create(config: GeminiEmbeddingConfig): GeminiEmbeddingService {
    const { apiKey, modelName } = config;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('apiKey is required and cannot be empty');
    }

    if (!modelName || modelName.trim() === '') {
      throw new Error('modelName is required and cannot be empty');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`✓ Initialized Gemini embedding service with model: ${modelName}`);

    return new GeminiEmbeddingService(model);
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('text is required and cannot be empty');
    }

    const result = await this.model.embedContent(text);
    return result.embedding.values;
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

    const result = await this.model.batchEmbedContents({
      requests: texts.map((text) => ({ content: { parts: [{ text }] } })),
    });

    return result.embeddings.map((embedding) => embedding.values);
  }
}