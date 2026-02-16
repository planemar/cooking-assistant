import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMAskingService, LLMEmbeddingService } from '../llm';
import type {
  ParentChunkDocument,
  ParentChunkDocumentStore,
} from '../parent-chunk-store';
import type { QueryMatch, VectorDBService } from '../vector-db';
import { MyCustomRAGService } from './my-custom-rag.service';

describe('MyCustomRAGService', () => {
  let vectorDB: VectorDBService;
  let embeddingService: LLMEmbeddingService;
  let askingService: LLMAskingService;
  let parentChunkStore: ParentChunkDocumentStore;
  let ragService: MyCustomRAGService;

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

    askingService = {
      ask: vi.fn(),
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

    ragService = MyCustomRAGService.create(
      vectorDB,
      embeddingService,
      askingService,
      parentChunkStore,
      mockConfig,
    );
  });

  describe('ask()', () => {
    it('should throw error for empty question', async () => {
      await expect(ragService.ask('')).rejects.toThrow(
        'question is required and cannot be empty',
      );
      await expect(ragService.ask('   ')).rejects.toThrow(
        'question is required and cannot be empty',
      );
    });

    it('should return NO_RESULTS_MESSAGE when no children match', async () => {
      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue([]);

      const result = await ragService.ask('How to cook pasta?');

      expect(result).toBe(
        'I could not find any relevant information in the cookbook to answer your question.',
      );
      expect(askingService.ask).not.toHaveBeenCalled();
    });

    it('should return NO_RESULTS_MESSAGE when parent not found in SQLite', async () => {
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

      const result = await ragService.ask('How to cook pasta?');

      expect(result).toBe(
        'I could not find any relevant information in the cookbook to answer your question.',
      );
      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1]);
      expect(askingService.ask).not.toHaveBeenCalled();
    });

    it('should return parent content as context for single child match', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: { parentId: 1, sourceFile: 'recipe.txt', childIndex: 0 },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'recipe.txt',
          parentIndex: 0,
          content: 'Boil water in a large pot. Add salt.',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);
      vi.mocked(askingService.ask).mockResolvedValue(
        'Boil water in a large pot and add salt.',
      );

      const result = await ragService.ask('How to cook pasta?');

      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1]);
      expect(askingService.ask).toHaveBeenCalled();

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];
      expect(promptArg).toContain('How to cook pasta?');
      expect(promptArg).toContain('Boil water in a large pot. Add salt.');
      expect(promptArg).toContain('[Document 1]');
      expect(promptArg).toContain('(Best match: 0.85)');

      expect(result).toBe('Boil water in a large pot and add salt.');
    });

    it('should deduplicate multiple children from same parent', async () => {
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
      vi.mocked(askingService.ask).mockResolvedValue('Cook pasta instructions');

      const result = await ragService.ask('How to cook pasta?');

      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1]);

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];
      const docCount = (promptArg.match(/\[Document \d+\]/g) || []).length;
      expect(docCount).toBe(1);
      expect(promptArg).toContain('(Best match: 0.85)');

      expect(result).toBe('Cook pasta instructions');
    });

    it('should include multiple parents for children from different parents', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe1.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: {
            parentId: 1,
            sourceFile: 'recipe1.txt',
            childIndex: 0,
          },
        },
        {
          id: 'chunk:recipe2.txt:2:0',
          document: 'Preheat oven',
          similarity: 0.82,
          metadata: {
            parentId: 2,
            sourceFile: 'recipe2.txt',
            childIndex: 0,
          },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Boil water in a large pot. Add salt. Add pasta.',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
        {
          id: 2,
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Preheat oven to 350F. Prepare baking sheet.',
          hash: 'def456',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);
      vi.mocked(askingService.ask).mockResolvedValue('Combined instructions');

      const result = await ragService.ask('How to cook?');

      expect(parentChunkStore.getParents).toHaveBeenCalledWith([1, 2]);

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];
      const docCount = (promptArg.match(/\[Document \d+\]/g) || []).length;
      expect(docCount).toBe(2);
      expect(promptArg).toContain(
        'Boil water in a large pot. Add salt. Add pasta.',
      );
      expect(promptArg).toContain(
        'Preheat oven to 350F. Prepare baking sheet.',
      );

      expect(result).toBe('Combined instructions');
    });

    it('should order context by best child similarity per parent', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe1.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: {
            parentId: 1,
            sourceFile: 'recipe1.txt',
            childIndex: 0,
          },
        },
        {
          id: 'chunk:recipe1.txt:1:1',
          document: 'Add salt',
          similarity: 0.8,
          metadata: {
            parentId: 1,
            sourceFile: 'recipe1.txt',
            childIndex: 1,
          },
        },
        {
          id: 'chunk:recipe2.txt:2:0',
          document: 'Preheat oven',
          similarity: 0.95,
          metadata: {
            parentId: 2,
            sourceFile: 'recipe2.txt',
            childIndex: 0,
          },
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
      vi.mocked(askingService.ask).mockResolvedValue('Answer');

      await ragService.ask('How to cook?');

      const callArgs = vi.mocked(parentChunkStore.getParents).mock.calls[0][0];
      expect(callArgs).toEqual(expect.arrayContaining([1, 2]));
      expect(callArgs.length).toBe(2);

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];
      const doc1Index = promptArg.indexOf('[Document 1]');
      const doc2Index = promptArg.indexOf('[Document 2]');
      const oven95Index = promptArg.indexOf('(Best match: 0.95)');
      const water85Index = promptArg.indexOf('(Best match: 0.85)');

      expect(doc1Index).toBeLessThan(doc2Index);
      expect(oven95Index).toBeLessThan(water85Index);
      expect(promptArg).toContain('Preheat oven content');
      expect(promptArg).toContain('Boil water content');
    });

    it('should build prompt with question and context', async () => {
      const childMatches: QueryMatch[] = [
        {
          id: 'chunk:recipe.txt:1:0',
          document: 'Boil water',
          similarity: 0.85,
          metadata: { parentId: 1, sourceFile: 'recipe.txt', childIndex: 0 },
        },
      ];

      const parents: ParentChunkDocument[] = [
        {
          id: 1,
          sourceFile: 'recipe.txt',
          parentIndex: 0,
          content: 'Parent content here',
          hash: 'abc123',
          syncedAt: 1708000000,
        },
      ];

      vi.mocked(embeddingService.embedRetrievalQuery).mockResolvedValue(
        mockEmbedding,
      );
      vi.mocked(vectorDB.query).mockResolvedValue(childMatches);
      vi.mocked(parentChunkStore.getParents).mockResolvedValue(parents);
      vi.mocked(askingService.ask).mockResolvedValue('Answer');

      await ragService.ask('What is the recipe?');

      const promptArg = vi.mocked(askingService.ask).mock.calls[0][0];

      expect(promptArg).toContain('What is the recipe?');
      expect(promptArg).toContain('Parent content here');
      expect(promptArg).toContain('You are a helpful cooking assistant');
      expect(promptArg).toContain("Context from user's cookbook:");
      expect(promptArg).toContain('User question:');
    });
  });
});
