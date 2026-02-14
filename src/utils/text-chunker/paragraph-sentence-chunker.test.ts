import { describe, it, expect } from 'vitest';
import { ParagraphSentenceChunker } from './paragraph-sentence-chunker';

describe('ParagraphSentenceChunker', () => {
  const chunker = new ParagraphSentenceChunker();

  describe('Small content and edge cases', () => {
    it('should return 1 chunk when content is below chunk size', () => {
      const input = 'Hello world';
      const result = chunker.chunk(input, 500, 100);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Hello world');
    });

    it('should return 1 chunk when content is exactly at chunk size', () => {
      const input = 'a'.repeat(500);
      const result = chunker.chunk(input, 500, 100);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('should return empty array for empty content', () => {
      expect(chunker.chunk('', 500, 100)).toEqual([]);
      expect(chunker.chunk('   ', 500, 100)).toEqual([]);
      expect(chunker.chunk('\n\n', 500, 100)).toEqual([]);
    });

    it('should handle single character content', () => {
      const result = chunker.chunk('X', 100, 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('X');
    });

    it('should handle very large chunk size', () => {
      const input = 'Short text here';
      const result = chunker.chunk(input, 10000, 50);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });
  });

  describe('Error handling', () => {
    it('should throw error when overlap >= chunk size', () => {
      expect(() => chunker.chunk('test', 100, 100)).toThrow();
      expect(() => chunker.chunk('test', 100, 150)).toThrow();
    });

    it('should throw error when chunk size is 0 or negative', () => {
      expect(() => chunker.chunk('test', 0, 0)).toThrow();
      expect(() => chunker.chunk('test', -100, 0)).toThrow();
    });

    it('should throw error when overlap is negative', () => {
      expect(() => chunker.chunk('test', 100, -10)).toThrow();
    });
  });

  describe('Paragraph-aware splitting', () => {
    it('should split paragraphs and respect boundaries', () => {
      const para1 = 'a'.repeat(150);
      const para2 = 'b'.repeat(150);
      const para3 = 'c'.repeat(150);
      const para4 = 'd'.repeat(150);
      const para5 = 'e'.repeat(150);
      const input = `${para1}\n\n${para2}\n\n${para3}\n\n${para4}\n\n${para5}`;
      const result = chunker.chunk(input, 400, 80);

      expect(result.length).toBeGreaterThan(1);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(480); // 400 + 80
      }
    });

    it('should preserve paragraph integrity when possible', () => {
      const para1 = 'a'.repeat(200);
      const para2 = 'b'.repeat(300);
      const para3 = 'c'.repeat(400);
      const input = `${para1}\n\n${para2}\n\n${para3}`;
      const result = chunker.chunk(input, 600, 100);

      expect(result[0]).toContain('a'.repeat(100));
      expect(result[0]).toContain('b'.repeat(100));
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Overlap behavior', () => {
    it('should add overlap between chunks', () => {
      const text = 'AAAAABBBBBCCCCCDDDDDEEEEEFFFFFGGGGGHHHHHIIIII';
      const result = chunker.chunk(text, 15, 5);

      expect(result.length).toBeGreaterThan(1);

      // First chunk has no overlap prepended
      expect(result[0].length).toBeLessThanOrEqual(15);

      // Other chunks can exceed chunkSize by up to chunkOverlap
      for (let i = 1; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(20); // 15 + 5
      }

      // Verify overlap connectivity
      for (let i = 1; i < result.length; i++) {
        const prevEnd = result[i - 1].slice(-5);
        expect(result[i].startsWith(prevEnd)).toBe(true);
      }
    });

    it('should preserve all data with overlap', () => {
      const text = 'AAAAABBBBBCCCCCDDDDDEEEEEFFFFFGGGGGHHHHHIIIII';
      const result = chunker.chunk(text, 15, 5);

      // Reconstruct by removing overlap from each chunk
      let reconstructed = result[0];
      for (let i = 1; i < result.length; i++) {
        reconstructed += result[i].slice(5);
      }

      expect(reconstructed).toBe(text);
    });

    it('should handle overlap when chunk is shorter than overlap size', () => {
      const text = 'AAA\n\nBBBBBBBBBB\n\nCCCCCCCCCC';
      const result = chunker.chunk(text, 15, 10);

      expect(result.length).toBeGreaterThan(1);

      // First chunk without overlap
      expect(result[0].length).toBeLessThanOrEqual(15);

      // Other chunks can exceed by up to overlap amount
      for (let i = 1; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(25); // 15 + 10
      }
    });

    it('should create chunks with no overlap when overlap is 0', () => {
      const input = 'a'.repeat(2000);
      const result = chunker.chunk(input, 500, 0);

      expect(result.length).toBe(4);
      const reconstructed = result.join('');
      expect(reconstructed).toBe(input);
    });
  });

  describe('Hard split fallback', () => {
    it('should split text with no natural boundaries', () => {
      const text = 'A'.repeat(100);
      const result = chunker.chunk(text, 25, 0);

      expect(result).toHaveLength(4);
      expect(result[0]).toBe('A'.repeat(25));
      expect(result[1]).toBe('A'.repeat(25));
      expect(result[2]).toBe('A'.repeat(25));
      expect(result[3]).toBe('A'.repeat(25));
    });

    it('should handle hard split with overlap', () => {
      const text = 'a'.repeat(2000);
      const result = chunker.chunk(text, 500, 100);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toBe('a'.repeat(500));
      expect(result[1].startsWith('a'.repeat(100))).toBe(true);

      // Verify no data loss
      let reconstructed = result[0];
      for (let i = 1; i < result.length; i++) {
        reconstructed += result[i].slice(100);
      }
      expect(reconstructed).toBe(text);
    });
  });

  describe('Sentence splitting', () => {
    it('should split large paragraph by sentences', () => {
      const text = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.';
      const result = chunker.chunk(text, 30, 5);

      expect(result.length).toBeGreaterThan(1);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(35); // 30 + 5
      }
    });

    it('should preserve different sentence endings', () => {
      const text = 'First sentence! Second sentence? Third sentence.';
      const result = chunker.chunk(text, 20, 3);

      const combined = result.join('');
      expect(combined).toContain('First sentence!');
      expect(combined).toContain('Second sentence?');
      expect(combined).toContain('Third sentence.');
    });

    it('should split sentences starting with lowercase', () => {
      const text = 'Mix well. then add salt. and stir thoroughly.';
      const result = chunker.chunk(text, 20, 3);

      expect(result.length).toBeGreaterThan(1);
      const combined = result.join('');
      expect(combined).toContain('Mix well.');
      expect(combined).toContain('then add salt.');
    });

    it('should handle text with no sentence boundaries', () => {
      const text = 'NoSentenceBoundariesHereJustOneVeryLongWordThatKeepsGoingAndGoingAndGoing';
      const result = chunker.chunk(text, 20, 5);

      expect(result.length).toBeGreaterThan(1);

      // First chunk without overlap
      expect(result[0].length).toBeLessThanOrEqual(20);

      // Other chunks can exceed by up to overlap amount
      for (let i = 1; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(25); // 20 + 5
      }
    });
  });

  describe('Real recipe content', () => {
    it('should handle real recipe text correctly', () => {
      const recipe = `Chicken Katsu Curry is a Japanese-inspired comfort food classic.

This recipe combines crispy breaded chicken cutlets with a rich, mildly spiced curry sauce.

The dish features tender chicken breast coated in panko breadcrumbs and fried until golden.

Served over steamed rice with curry sauce, it's a satisfying and flavorful meal.

For the chicken:
- 2 chicken breasts
- 100g plain flour
- 2 eggs beaten
- 150g panko breadcrumbs
- Salt and pepper
- Vegetable oil for frying

For the curry sauce:
- 1 onion diced
- 2 carrots diced
- 2 cloves garlic minced
- 2 tbsp curry powder
- 2 tbsp plain flour
- 500ml chicken stock
- 1 tbsp soy sauce
- 1 tbsp honey

1. Prepare the chicken by flattening breasts to even thickness.
2. Set up breading station with flour, beaten eggs, and panko.
3. Coat each chicken piece in flour, then egg, then panko.
4. Heat oil in a large pan over medium-high heat.
5. Fry chicken for 4-5 minutes per side until golden and cooked through.
6. For the sauce, sauté onion and carrots until softened.
7. Add garlic and curry powder, cook for 1 minute.
8. Stir in flour, then gradually add stock.
9. Add soy sauce and honey, simmer for 15 minutes.
10. Slice chicken and serve over rice with curry sauce.
`;

      const result = chunker.chunk(recipe, 500, 100);

      expect(result.length).toBeGreaterThan(0);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].trim().length).toBeGreaterThan(0);
        expect(result[i].length).toBeLessThanOrEqual(600); // 500 + 100
      }
    });
  });
});
