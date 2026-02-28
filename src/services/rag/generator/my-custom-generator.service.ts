import { logger } from '../../../utils/logger';
import type { LLMAskingService } from '../../llm';
import type { RetrieverService } from '../retriever';
import type { GeneratorService } from './generator.interface';

function buildPrompt(question: string, context: string): string {
  return `You are a helpful cooking assistant that answers questions based on the provided recipes.

Context from user's cookbook:
${context}

User question: ${question}

Instructions:
- Answer the question using only the information provided in the context above
- If the context doesn't contain enough information to answer the question, say so clearly
- Be concise and accurate
- Reference specific documents when applicable

Answer:`;
}

const NO_RESULTS_MESSAGE =
  'I could not find any relevant information in the cookbook to answer your question.';

export class MyCustomGeneratorService implements GeneratorService {
  private retrieverService: RetrieverService;
  private askingService: LLMAskingService;

  private constructor(
    retrieverService: RetrieverService,
    askingService: LLMAskingService,
  ) {
    this.retrieverService = retrieverService;
    this.askingService = askingService;
  }

  static create(
    retrieverService: RetrieverService,
    askingService: LLMAskingService,
  ): MyCustomGeneratorService {
    logger.info('✓ Initialized Generator service');
    return new MyCustomGeneratorService(retrieverService, askingService);
  }

  async generate(question: string): Promise<string> {
    const { entries } = await this.retrieverService.retrieve(question);

    if (entries.length === 0) {
      return NO_RESULTS_MESSAGE;
    }

    const contextParts = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      contextParts.push(
        `[Document ${i + 1}] Source: ${entry.sourceFile} (Best match: ${entry.similarity.toFixed(2)})\n${entry.content}`,
      );
    }
    const context = contextParts.join('\n\n');

    const prompt = buildPrompt(question, context);

    logger.debug(`Prompt: ${prompt}`);

    return this.askingService.ask(prompt);
  }
}
