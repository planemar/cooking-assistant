import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SQLiteParentChunkStore } from './sqlite-parent-chunk-store.service';

describe('SQLiteParentChunkStore', () => {
  let store: SQLiteParentChunkStore;

  beforeEach(() => {
    // Create fresh in-memory database for each test (isolation)
    store = SQLiteParentChunkStore.create({ dbPath: ':memory:' });
  });

  afterEach(() => {
    // Close database connection to prevent resource leaks
    store.close();
  });

  describe('insertParents', () => {
    it('inserts new parents and returns IDs', () => {
      const parents = [
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'First parent chunk',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 1,
          content: 'Second parent chunk',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Different recipe',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
      ];

      const ids = store.insertParents(parents);

      expect(ids).toHaveLength(3);
      expect(ids[0]).toBe(1);
      expect(ids[1]).toBe(2);
      expect(ids[2]).toBe(3);

      // Verify content is stored correctly
      const retrieved = store.getParents([1, 2, 3]);
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].content).toBe('First parent chunk');
      expect(retrieved[1].content).toBe('Second parent chunk');
      expect(retrieved[2].content).toBe('Different recipe');
    });

    it('returns empty array when given empty array', () => {
      const ids = store.insertParents([]);
      expect(ids).toEqual([]);
    });
  });

  describe('updateParents', () => {
    it('updates existing parents by ID', () => {
      // First insert some parents
      const parents = [
        {
          sourceFile: 'recipe.txt',
          parentIndex: 0,
          content: 'Original content',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
      ];

      const ids = store.insertParents(parents);
      const originalId = ids[0];

      // Update with different content
      const updated = [
        {
          id: originalId,
          sourceFile: 'recipe.txt',
          parentIndex: 0,
          content: 'Updated content',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
      ];

      store.updateParents(updated);

      // Verify content was updated
      const retrieved = store.getParents([originalId]);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].content).toBe('Updated content');
      expect(retrieved[0].hash).toBe('hash2');
      expect(retrieved[0].syncedAt).toBe(1708000100);
    });

    it('does nothing when given empty array', () => {
      store.updateParents([]);
      // Should not throw
    });
  });

  describe('getParents', () => {
    it('retrieves parents by IDs', () => {
      const parents = [
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'First chunk',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 1,
          content: 'Second chunk',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Third chunk',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
      ];

      const ids = store.insertParents(parents);

      // Fetch 2 by ID
      const retrieved = store.getParents([ids[0], ids[2]]);

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].id).toBe(ids[0]);
      expect(retrieved[0].content).toBe('First chunk');
      expect(retrieved[0].sourceFile).toBe('recipe1.txt');
      expect(retrieved[0].parentIndex).toBe(0);
      expect(retrieved[0].hash).toBe('hash1');
      expect(retrieved[0].syncedAt).toBe(1708000000);

      expect(retrieved[1].id).toBe(ids[2]);
      expect(retrieved[1].content).toBe('Third chunk');
      expect(retrieved[1].sourceFile).toBe('recipe2.txt');
    });

    it('returns empty array for non-existent IDs', () => {
      const retrieved = store.getParents([999, 1000]);
      expect(retrieved).toEqual([]);
    });

    it('returns empty array when given empty array', () => {
      const retrieved = store.getParents([]);
      expect(retrieved).toEqual([]);
    });
  });

  describe('getParentsBySourceFile', () => {
    it('returns all parents for a file ordered by parentIndex', () => {
      const parents = [
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Recipe1 chunk 0',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Recipe2 chunk 0',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 1,
          content: 'Recipe1 chunk 1',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 2,
          content: 'Recipe1 chunk 2',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
      ];

      store.insertParents(parents);

      const recipe1Parents = store.getParentsBySourceFile('recipe1.txt');

      expect(recipe1Parents).toHaveLength(3);
      expect(recipe1Parents[0].content).toBe('Recipe1 chunk 0');
      expect(recipe1Parents[0].parentIndex).toBe(0);
      expect(recipe1Parents[1].content).toBe('Recipe1 chunk 1');
      expect(recipe1Parents[1].parentIndex).toBe(1);
      expect(recipe1Parents[2].content).toBe('Recipe1 chunk 2');
      expect(recipe1Parents[2].parentIndex).toBe(2);
    });
  });

  describe('getAllSourceFileHashes', () => {
    it('returns unique source files with hashes', () => {
      const parents = [
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Chunk 1',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 1,
          content: 'Chunk 2',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Chunk 3',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
        {
          sourceFile: 'recipe3.txt',
          parentIndex: 0,
          content: 'Chunk 4',
          hash: 'hash3',
          syncedAt: 1708000200,
        },
      ];

      store.insertParents(parents);

      const hashes = store.getAllSourceFileHashes();

      expect(hashes).toHaveLength(3);

      // Sort for deterministic comparison
      const sorted = hashes.sort((a, b) =>
        a.sourceFile.localeCompare(b.sourceFile),
      );

      expect(sorted[0]).toEqual({ sourceFile: 'recipe1.txt', hash: 'hash1' });
      expect(sorted[1]).toEqual({ sourceFile: 'recipe2.txt', hash: 'hash2' });
      expect(sorted[2]).toEqual({ sourceFile: 'recipe3.txt', hash: 'hash3' });
    });
  });

  describe('deleteBySourceFile', () => {
    it('removes all parents for that file', () => {
      const parents = [
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Recipe1 chunk',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Recipe2 chunk',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
      ];

      store.insertParents(parents);

      // Delete recipe1.txt
      store.deleteBySourceFile('recipe1.txt');

      // recipe1.txt should be gone
      const recipe1Parents = store.getParentsBySourceFile('recipe1.txt');
      expect(recipe1Parents).toEqual([]);

      // recipe2.txt should remain
      const recipe2Parents = store.getParentsBySourceFile('recipe2.txt');
      expect(recipe2Parents).toHaveLength(1);
      expect(recipe2Parents[0].sourceFile).toBe('recipe2.txt');
    });
  });

  describe('deleteAll', () => {
    it('clears the table', () => {
      const parents = [
        {
          sourceFile: 'recipe1.txt',
          parentIndex: 0,
          content: 'Chunk 1',
          hash: 'hash1',
          syncedAt: 1708000000,
        },
        {
          sourceFile: 'recipe2.txt',
          parentIndex: 0,
          content: 'Chunk 2',
          hash: 'hash2',
          syncedAt: 1708000100,
        },
      ];

      store.insertParents(parents);

      store.deleteAll();

      const hashes = store.getAllSourceFileHashes();
      expect(hashes).toEqual([]);
    });
  });

  describe('close', () => {
    it('closes the database', () => {
      store.close();

      // Subsequent operations should throw
      expect(() => store.getParents([1])).toThrow();
    });
  });

  describe('config validation', () => {
    it('throws error for empty dbPath', () => {
      expect(() => SQLiteParentChunkStore.create({ dbPath: '' })).toThrow(
        'dbPath must be a non-empty string',
      );
    });

    it('throws error for whitespace-only dbPath', () => {
      expect(() => SQLiteParentChunkStore.create({ dbPath: '   ' })).toThrow(
        'dbPath must be a non-empty string',
      );
    });

    it('accepts :memory: as valid dbPath', () => {
      expect(() =>
        SQLiteParentChunkStore.create({ dbPath: ':memory:' }),
      ).not.toThrow();
    });
  });
});
