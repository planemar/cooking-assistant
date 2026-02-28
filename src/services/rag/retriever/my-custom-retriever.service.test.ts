import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMEmbeddingService } from '../../llm';
import type {
  ParentChunkDocument,
  ParentChunkDocumentStore,
} from '../../parent-chunk-store';
import type { QueryMatch, VectorDBService } from '../../vector-db';
import { MyCustomRetrieverService } from './my-custom-retriever.service';

describe('MyCustomRetrieverService', () => {
  let vectorDB: VectorDBService;
  let embeddingService: LLMEmbeddingService;
  let parentChunkStore: ParentChunkDocumentStore;
  let retrieverService: MyCustomRetrieverService;

  const mockEmbedding = [0.1, 0.2, 0.3];
  const mockConfig = { nResults: 5, minSimilarity: 0.7 };

  beforeEach(() => {
    vectorDB = {
      query: vi.fn(),
      addDocuments: vi.fn(),
      updateDocuments: vi.fn(),
      deleteDocuments: vi.fn(),
      getDocument: vi.fn(),
      getAllDocumentInfo: vi.fn(),
      reset: vi.fn(),
    };

    embeddingService = {
      embed: vi.fn(),
      embedBatch: vi.fn(),
      embedRetrievalQuery: vi.fn(),
      embedRetrievalDocument: vi.fn(),
      embedBatchRetrievalDocument: vi.fn(),
    };

    parentChunkStore = {
      insertParents: vi.fn(),
      updateParents: vi.fn(),
      getParents: vi.fn(),
      getParentsBySourceFile: vi.fn(),
      getAllSourceFileHashes: vi.fn(),
      deleteBySourceFile: vi.fn(),
      deleteAll: vi.fn(),
      close: vi.fn(),
    };

    retrieverService = MyCustomRetrieverService.create(
      vectorDB,
      embeddingService,
      parentChunkStore,
      mockConfig,
    );
  });

  describe('retrieve()', () => {
    it('should throw error for empty question', async () => {
      await expect(retrieverService.retrieve('')).rejects.toThrow(
        'question is required and cannot be empty',
      );
      await expect(retrieverService.retrieve('   ')).rejects.toThrow(
        'question is required and cannot be empty',
      );
    });

    it('should return empty entries when no children match', async () => {
      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue([]);

      const result = await retrieverService.retrieve('How to cook pasta?');

      expect(result).toEqual({ entries: [] });
      expect(parentChunkStore.getParents).not.toHaveBeenCalled();
    });

    it('should return empty entries when parents not found in SQLite', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: { parentId: 1, sourceFile: 'recipe.txt', childIndex: 0 },
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue([]);

      const result = await retrieverService.retrieve('How to cook pasta?');

      expect(result).toEqual({ entries: [] });
      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1]);
    });

    it('should deduplicate multiple children from same parent keeping best similarity', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: { parentId: 1, sourceFile: 'recipe.txt', childIndex: 0 },
        },
        {
          id: 'chunk:recipe.txt:1:1',
          document: 'Add salt',
          similarity: 0.8,
          metadata: { parentId: 1, sourceFile: 'recipe.txt', childIndex: 1 },
        },
        {
          id: 'chunk:recipe.txt:1:2',
          document: 'Add pasta',
          similarity: 0.78,
          metadata: { parentId: 1, sourceFile: 'recipe.txt', childIndex: 2 },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'recipe.txt',
          parentIndex: 0,
          content: 'Boil water in a large pot. Add salt. Add pasta.',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);

      const result = await retrieverService.retrieve('How to cook pasta?');

      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1]);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].similarity).toBe(0.85);
    });

    it('should return multiple entries for different parents', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe1.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: { parentId: 1, sourceFile: 'recipe1.txt', childIndex: 0 },
        },
        {
          id: 'chunk:recipe2.txt:2:0',
          document: 'Preheat oven',
          similarity: 0.82,
          metadata: { parentId: 2, sourceFile: 'recipe2.txt', childIndex: 0 },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Boil water in a large pot.',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
        {
          id: 2,
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Preheat oven to 350F.',
          hash: 'def456',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);

      const result = await retrieverService.retrieve('How to cook?');

      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1, 2]);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].sourceFile).toBe('recipe1.txt');
      expect(result.entries[0].content).toBe('Boil water in a large pot.');
      expect(result.entries[1].sourceFile).toBe('recipe2.txt');
      expect(result.entries[1].content).toBe('Preheat oven to 350F.');
    });

    it('should order entries by similarity descending', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe1.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: { parentId: 1, sourceFile: 'recipe1.txt', childIndex: 0 },
        },
        {
          id: 'chunk:recipe2.txt:2:0',
          document: 'Preheat oven',
          similarity: 0.95,
          metadata: { parentId: 2, sourceFile: 'recipe2.txt', childIndex: 0 },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Boil water content',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
        {
          id: 2,
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Preheat oven content',
          hash: 'def456',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);

      const result = await retrieverService.retrieve('How to cook?');

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].similarity).toBe(0.95);
      expect(result.entries[1].similarity).toBe(0.85);
    });

    it('should include sourceFile in entries', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:my-recipe.txt:1:0',
          document: 'Some content',
          similarity: 0.9,
          metadata: { parentId: 1, sourceFile: 'my-recipe.txt', childIndex: 0 },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'my-recipe.txt',
          parentIndex: 0,
          content: 'Full parent content',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);

      const result = await retrieverService.retrieve('What is the recipe?');

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].sourceFile).toBe('my-recipe.txt');
      expect(result.entries[0].content).toBe('Full parent content');
    });
  });
});
