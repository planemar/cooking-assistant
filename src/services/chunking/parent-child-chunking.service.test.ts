import { beforeEach, describe, expect, it } from 'vitest';
import { ParagraphSentenceChunker } from '../../utils/text-chunker/paragraph-sentence-chunker';
import type { TextChunker } from '../../utils/text-chunker/text-chunker.interface';
import type { ParentChildChunkingConfig } from './parent-child-chunking.service';
import { ParentChildChunkingService } from './parent-child-chunking.service';

describe('ParentChildChunkingService', () => {
  let textChunker: TextChunker;
  let config: ParentChildChunkingConfig;

  beforeEach(() => {
    textChunker = new ParagraphSentenceChunker();
    config = {
      childChunkSize: 500,
      childChunkOverlapFactor: 0.2,
      parentChunkSizeFactor: 5,
    };
  });

  describe('config validation', () => {
    it('should throw error when parentChunkSizeFactor < 1', () => {
      const invalidConfig = { ...config, parentChunkSizeFactor: 0.5 };
      expect(() =>
        ParentChildChunkingService.create(textChunker, invalidConfig),
      ).toThrow('parentChunkSizeFactor must be >= 1');
    });

    it('should throw error when childChunkOverlapFactor >= 1', () => {
      const invalidConfig = { ...config, childChunkOverlapFactor: 1.0 };
      expect(() =>
        ParentChildChunkingService.create(textChunker, invalidConfig),
      ).toThrow('childChunkOverlapFactor must be > 0 and < 1');
    });

    it('should throw error when childChunkOverlapFactor <= 0', () => {
      const invalidConfig = { ...config, childChunkOverlapFactor: 0 };
      expect(() =>
        ParentChildChunkingService.create(textChunker, invalidConfig),
      ).toThrow('childChunkOverlapFactor must be > 0 and < 1');
    });

    it('should throw error when childChunkSize <= 0', () => {
      const invalidConfig = { ...config, childChunkSize: 0 };
      expect(() =>
        ParentChildChunkingService.create(textChunker, invalidConfig),
      ).toThrow('childChunkSize must be > 0');
    });

    it('should accept valid config', () => {
      expect(() =>
        ParentChildChunkingService.create(textChunker, config),
      ).not.toThrow();
    });
  });

  describe('chunk()', () => {
    it('should return empty array for empty content', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const result = service.chunk('');
      expect(result).toEqual([]);
    });

    it('should return 1 parent with 1 child for small content (below parent chunk size)', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const content =
        'This is a short recipe with less than 200 characters. It should fit in one parent chunk and one child chunk.';

      const result = service.chunk(content);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe(content);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0]).toBe(content);
    });

    it('should split large content into multiple parents', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const paragraph =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50);
      const content = Array(6).fill(paragraph).join('\n\n');

      const result = service.chunk(content);

      expect(result.length).toBeGreaterThan(1);
      for (const parent of result) {
        expect(parent.children.length).toBeGreaterThan(0);
      }
    });

    it('should have each parent with children that are string arrays', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const content =
        'Paragraph one with some text. '.repeat(100) +
        '\n\n' +
        'Paragraph two with more text. '.repeat(100);

      const result = service.chunk(content);

      for (const parent of result) {
        expect(Array.isArray(parent.children)).toBe(true);
        for (const child of parent.children) {
          expect(typeof child).toBe('string');
        }
      }
    });

    it('should produce parent chunks with no overlap (parent texts have no shared content)', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const paragraph1 = 'First section of the recipe. '.repeat(50);
      const paragraph2 = 'Second section of the recipe. '.repeat(50);
      const paragraph3 = 'Third section of the recipe. '.repeat(50);
      const content = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

      const result = service.chunk(content);

      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          const currentParent = result[i].text;
          const nextParent = result[i + 1].text;
          const endOfCurrent = currentParent.slice(-100);
          const startOfNext = nextParent.slice(0, 100);
          expect(startOfNext).not.toBe(endOfCurrent);
        }
      } else {
        expect(result).toHaveLength(1);
      }
    });

    it('should produce children with overlap within each parent', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const content = 'Sentence one. '.repeat(200);

      const result = service.chunk(content);

      for (const parent of result) {
        if (parent.children.length > 1) {
          for (let i = 0; i < parent.children.length - 1; i++) {
            const currentChild = parent.children[i];
            const nextChild = parent.children[i + 1];
            const overlapSize = Math.floor(
              config.childChunkSize * config.childChunkOverlapFactor,
            );

            if (overlapSize > 0 && currentChild.length >= overlapSize) {
              const endOfCurrent = currentChild.slice(-overlapSize);
              const startOfNext = nextChild.slice(0, overlapSize);
              expect(startOfNext).toBe(endOfCurrent);
            }
          }
        }
      }
    });

    it('should create single parent with multiple children for content between parent boundaries', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const sentence = 'This is a sentence in the recipe. ';
      const content = sentence.repeat(60);

      const result = service.chunk(content);

      expect(result).toHaveLength(1);
      expect(result[0].children.length).toBeGreaterThan(1);
    });

    it('should have each parent covered by its children (children span parent content)', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const paragraph = 'Recipe step with detailed instructions. '.repeat(50);
      const content = Array(3).fill(paragraph).join('\n\n');

      const result = service.chunk(content);

      for (const parent of result) {
        expect(parent.children.length).toBeGreaterThan(0);

        if (parent.children.length === 1) {
          expect(parent.children[0]).toBe(parent.text);
        } else {
          const allChildrenText = parent.children.join('');
          expect(allChildrenText.length).toBeGreaterThanOrEqual(
            parent.text.length,
          );
        }
      }
    });

    it('should handle whitespace-only content as empty', () => {
      const service = ParentChildChunkingService.create(textChunker, config);
      const result = service.chunk('   \n\n   \t\t   ');
      expect(result).toHaveLength(0);
    });
  });
});
