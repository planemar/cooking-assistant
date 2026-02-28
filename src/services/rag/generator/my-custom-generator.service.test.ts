import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMAskingService } from '../../llm';
import type { RetrieverService } from '../retriever';
import { MyCustomGeneratorService } from './my-custom-generator.service';

describe('MyCustomGeneratorService', () => {
  let retrieverService: RetrieverService;
  let askingService: LLMAskingService;
  let generatorService: MyCustomGeneratorService;

  beforeEach(() => {
    retrieverService = {
      retrieve: vi.fn(),
    };

    askingService = {
      ask: vi.fn(),
    };

    generatorService = MyCustomGeneratorService.create(
      retrieverService,
      askingService,
    );
  });

  describe('generate()', () => {
    it('should propagate retriever error for empty question', async () => {
      vi.mocked(retrieverService.retrieve).mockRejectedValue(
        new Error('question is required and cannot be empty'),
      );

      await expect(generatorService.generate('')).rejects.toThrow(
        'question is required and cannot be empty',
      );
      expect(askingService.ask).not.toHaveBeenCalled();
    });

    it('should return NO_RESULTS_MESSAGE when retriever returns empty entries without calling LLM', async () => {
      vi.mocked(retrieverService.retrieve).mockResolvedValue({ entries: [] });

      const result = await generatorService.generate('How to cook pasta?');

      expect(result).toBe(
        'I could not find any relevant information in the cookbook to answer your question.',
      );
      expect(askingService.ask).not.toHaveBeenCalled();
    });

    it('should format context with [Document N] headers and similarity scores', async () => {
      vi.mocked(retrieverService.retrieve).mockResolvedValue({
        entries: [
          {
            sourceFile: 'recipe1.txt',
            content: 'Boil water content',
            similarity: 0.95,
          },
          {
            sourceFile: 'recipe2.txt',
            content: 'Preheat oven content',
            similarity: 0.82,
          },
        ],
      });
      vi.mocked(askingService.ask).mockResolvedValue('Answer');

      await generatorService.generate('How to cook?');

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];
      expect(promptArg).toContain(
        '[Document 1] Source: recipe1.txt (Best match: 0.95)',
      );
      expect(promptArg).toContain('Boil water content');
      expect(promptArg).toContain(
        '[Document 2] Source: recipe2.txt (Best match: 0.82)',
      );
      expect(promptArg).toContain('Preheat oven content');
    });

    it('should build prompt containing question, context, and template text', async () => {
      vi.mocked(retrieverService.retrieve).mockResolvedValue({
        entries: [
          {
            sourceFile: 'recipe.txt',
            content: 'Parent content here',
            similarity: 0.85,
          },
        ],
      });
      vi.mocked(askingService.ask).mockResolvedValue('Answer');

      await generatorService.generate('What is the recipe?');

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];
      expect(promptArg).toContain('What is the recipe?');
      expect(promptArg).toContain('Parent content here');
      expect(promptArg).toContain('You are a helpful cooking assistant');
      expect(promptArg).toContain("Context from user's cookbook:");
      expect(promptArg).toContain('User question:');
    });

    it('should return the LLM response as-is', async () => {
      vi.mocked(retrieverService.retrieve).mockResolvedValue({
        entries: [
          {
            sourceFile: 'recipe.txt',
            content: 'Some content',
            similarity: 0.9,
          },
        ],
      });
      vi.mocked(askingService.ask).mockResolvedValue(
        'Cook the pasta for 10 minutes.',
      );

      const result = await generatorService.generate('How to cook pasta?');

      expect(result).toBe('Cook the pasta for 10 minutes.');
    });
  });
});
