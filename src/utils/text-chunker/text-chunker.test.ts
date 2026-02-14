import { describe, it, expect } from 'vitest';
import { ParagraphSentenceChunker } from './text-chunker';

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
  });

  describe('Paragraph-aware splitting', () => {
    it('should split two paragraphs into 2 chunks with overlap', () => {
      const para1 = 'a'.repeat(300);
      const para2 = 'b'.repeat(300);
      const input = `${para1}\n\n${para2}`;
      const result = chunker.chunk(input, 400, 80);

      expect(result.length).toBeGreaterThan(1);
      // First chunk should contain first paragraph
      expect(result[0]).toContain('a'.repeat(100));
      // Verify overlap exists (second chunk starts with last 80 chars of first chunk)
      const firstChunkEnd = result[0].slice(-80);
      expect(result[1].startsWith(firstChunkEnd)).toBe(true);
    });

    it('should respect paragraph boundaries when accumulating chunks', () => {
      const para1 = 'a'.repeat(150);
      const para2 = 'b'.repeat(150);
      const para3 = 'c'.repeat(150);
      const para4 = 'd'.repeat(150);
      const para5 = 'e'.repeat(150);
      const input = `${para1}\n\n${para2}\n\n${para3}\n\n${para4}\n\n${para5}`;
      const result = chunker.chunk(input, 400, 80);

      expect(result.length).toBeGreaterThan(1);
      // Each chunk should not exceed the chunk size significantly (allowing for paragraph boundaries)
      for (let i = 0; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(450); // Allow some tolerance for paragraph boundaries
      }
    });

    it('should preserve paragraph integrity when possible', () => {
      const para1 = 'a'.repeat(200);
      const para2 = 'b'.repeat(300);
      const para3 = 'c'.repeat(400);
      const input = `${para1}\n\n${para2}\n\n${para3}`;
      const result = chunker.chunk(input, 600, 100);

      // First chunk should contain para1 + para2 (500 chars < 600)
      expect(result[0]).toContain('a'.repeat(100));
      expect(result[0]).toContain('b'.repeat(100));

      // Verify chunks exist
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Sentence-aware fallback', () => {
    it('should fall back to sentence splitting for large paragraphs', () => {
      const sentences = [
        'This is sentence one. ',
        'This is sentence two. ',
        'This is sentence three. ',
        'This is sentence four. ',
        'This is sentence five. ',
      ];
      const paragraph = sentences.join('').repeat(10); // ~1000 chars
      const result = chunker.chunk(paragraph, 500, 100);

      expect(result.length).toBeGreaterThan(1);
      // Each chunk should be around the chunk size
      for (let i = 0; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(600); // Allow some tolerance
      }
    });
  });

  describe('Hard character split fallback', () => {
    it('should fall back to hard character split for huge sentences', () => {
      const hugeSentence = 'a'.repeat(2000);
      const result = chunker.chunk(hugeSentence, 500, 100);

      expect(result.length).toBeGreaterThan(1);
      // First chunk should be exactly 500 chars
      expect(result[0]).toBe('a'.repeat(500));
      // Verify overlap (second chunk should start with last 100 chars of first)
      expect(result[1].startsWith('a'.repeat(100))).toBe(true);
    });
  });

  describe('No overlap mode', () => {
    it('should create chunks with no overlap when overlap is 0', () => {
      const input = 'a'.repeat(2000);
      const result = chunker.chunk(input, 500, 0);

      expect(result.length).toBe(4); // 2000 / 500 = 4
      // Verify no overlap: concatenating all chunks should equal input
      const reconstructed = result.join('');
      expect(reconstructed).toBe(input);
    });
  });

  describe('Real recipe content', () => {
    it('should handle real recipe text correctly', () => {
      const recipeOverview = `Chicken Katsu Curry is a Japanese-inspired comfort food classic.

This recipe combines crispy breaded chicken cutlets with a rich, mildly spiced curry sauce.

The dish features tender chicken breast coated in panko breadcrumbs and fried until golden.

Served over steamed rice with curry sauce, it's a satisfying and flavorful meal.`;

      const recipeIngredients = `For the chicken:
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
- 1 tbsp honey`;

      const recipeInstructions = `1. Prepare the chicken by flattening breasts to even thickness.
2. Set up breading station with flour, beaten eggs, and panko.
3. Coat each chicken piece in flour, then egg, then panko.
4. Heat oil in a large pan over medium-high heat.
5. Fry chicken for 4-5 minutes per side until golden and cooked through.
6. For the sauce, sauté onion and carrots until softened.
7. Add garlic and curry powder, cook for 1 minute.
8. Stir in flour, then gradually add stock.
9. Add soy sauce and honey, simmer for 15 minutes.
10. Slice chicken and serve over rice with curry sauce.`;

      const fullRecipe = `${recipeOverview}\n\n${recipeIngredients}\n\n${recipeInstructions}`;

      const result = chunker.chunk(fullRecipe, 500, 100);

      expect(result.length).toBeGreaterThan(0);
      // Verify no chunk is empty
      for (let i = 0; i < result.length; i++) {
        expect(result[i].trim().length).toBeGreaterThan(0);
      }
      // Verify all chunks are within reasonable size bounds
      for (let i = 0; i < result.length; i++) {
        expect(result[i].length).toBeLessThanOrEqual(600); // Allow some tolerance
      }
    });
  });
});
