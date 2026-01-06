import { GoogleGenAI } from '@google/genai';
import { LLMAskingService } from '../llm.interface';
import { logger } from '../../../utils/logger';
import { GeminiModelSpecificConfig } from './gemini.service';

export class GeminiAskingService implements LLMAskingService {
  private genAI: GoogleGenAI;
  private modelName: string;

  private constructor(genAI: GoogleGenAI, modelName: string) {
    this.genAI = genAI;
    this.modelName = modelName;
  }

  static create(config: GeminiModelSpecificConfig): LLMAskingService {
    const { apiKey, modelName } = config;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('apiKey is required and cannot be empty');
    }

    if (!modelName || modelName.trim() === '') {
      throw new Error('modelName is required and cannot be empty');
    }

    const genAI = new GoogleGenAI({ apiKey });

    logger.info('✓ Initialized Gemini asking service');

    return new GeminiAskingService(genAI, modelName);
  }

  async ask(prompt: string): Promise<string> {
    if (prompt.length === 0) {
      return "";
    }

    const resp = await this.genAI.models.generateContent({
      model: this.modelName,
      contents: prompt,
    })

    if (!resp.text) {
      throw new Error('No answer returned from Gemini API');
    }

    return resp.text;
  }
}
