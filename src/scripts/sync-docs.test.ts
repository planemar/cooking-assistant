import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParentChunkResult, ParentChildChunkingService } from '../services/chunking/parent-child-chunking.service';
import type { LLMEmbeddingService } from '../services/llm/llm.interface';
import type { ParentChunkDocumentStore } from '../services/parent-chunk-store/parent-chunk-store.interface';
import type { VectorDBService } from '../services/vector-db/vector-db.interface';
import { syncDocumentsCore } from './sync-docs';

describe('syncDocumentsCore', () => {
  let mockVectorDB: VectorDBService;
  let mockEmbeddingService: LLMEmbeddingService;
  let mockChunkingService: ParentChildChunkingService;
  let mockParentStore: ParentChunkDocumentStore;
  let mockReadFiles: ReturnType<typeof vi.fn>;
  let mockComputeHash: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockVectorDB = {
      addDocuments: vi.fn().mockResolvedValue(undefined),
      updateDocuments: vi.fn().mockResolvedValue(undefined),
      deleteDocuments: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      getDocument: vi.fn().mockResolvedValue(null),
      getAllDocumentInfo: vi.fn().mockResolvedValue([]),
      reset: vi.fn().mockResolvedValue(undefined),
    };

    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue([]),
      embedBatch: vi.fn().mockResolvedValue([[]]),
      embedRetrievalQuery: vi.fn().mockResolvedValue([]),
      embedRetrievalDocument: vi.fn().mockResolvedValue([]),
      embedBatchRetrievalDocument: vi.fn().mockImplementation(async (texts: string[]) => {
        return texts.map((_, index) => Array(384).fill(index * 0.1));
      }),
    };

    mockChunkingService = {
      chunk: vi.fn().mockReturnValue([
        {
          text: 'parent text 1',
          children: ['child 1.1', 'child 1.2'],
        },
        {
          text: 'parent text 2',
          children: ['child 2.1', 'child 2.2'],
        },
      ] as ParentChunkResult[]),
    } as any;

    mockParentStore = {
      insertParents: vi.fn().mockReturnValue([1, 2]),
      updateParents: vi.fn(),
      getParents: vi.fn().mockReturnValue([]),
      getParentsBySourceFile: vi.fn().mockReturnValue([]),
      getAllSourceFileHashes: vi.fn().mockReturnValue([]),
      deleteBySourceFile: vi.fn(),
      deleteAll: vi.fn(),
    };

    mockReadFiles = vi.fn().mockResolvedValue([]);
    mockComputeHash = vi.fn().mockReturnValue('abc123');
  });

  it('Test 1: New file creates parents + children', async () => {
    const fileContent = 'x'.repeat(2000);
    mockReadFiles.mockResolvedValue([
      { fileName: 'recipe.txt', content: fileContent },
    ]);
    mockComputeHash.mockReturnValue('hash123');
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'parent text 1',
        children: ['child 1.1', 'child 1.2'],
      },
      {
        text: 'parent text 2',
        children: ['child 2.1', 'child 2.2'],
      },
    ]);
    mockParentStore.getAllSourceFileHashes = vi.fn().mockReturnValue([]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([10, 11]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    expect(mockParentStore.insertParents).toHaveBeenCalledTimes(1);
    const insertCall = (mockParentStore.insertParents as any).mock.calls[0][0];
    expect(insertCall).toHaveLength(2);
    expect(insertCall[0]).toMatchObject({
      sourceFile: 'recipe.txt',
      parentIndex: 0,
      content: 'parent text 1',
      hash: 'hash123',
    });
    expect(insertCall[1]).toMatchObject({
      sourceFile: 'recipe.txt',
      parentIndex: 1,
      content: 'parent text 2',
      hash: 'hash123',
    });

    expect(mockVectorDB.addDocuments).toHaveBeenCalledTimes(1);
    const addDocsCall = (mockVectorDB.addDocuments as any).mock.calls[0][0];
    expect(addDocsCall).toHaveLength(4);
    expect(addDocsCall[0].id).toBe('chunk:recipe.txt:10:0');
    expect(addDocsCall[1].id).toBe('chunk:recipe.txt:10:1');
    expect(addDocsCall[2].id).toBe('chunk:recipe.txt:11:0');
    expect(addDocsCall[3].id).toBe('chunk:recipe.txt:11:1');
  });

  it('Test 2: Small file (below parent chunk size) creates 1 parent + 1 child', async () => {
    const fileContent = 'x'.repeat(100);
    mockReadFiles.mockResolvedValue([
      { fileName: 'small.txt', content: fileContent },
    ]);
    mockComputeHash.mockReturnValue('smallhash');
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'small parent text',
        children: ['small child text'],
      },
    ]);
    mockParentStore.getAllSourceFileHashes = vi.fn().mockReturnValue([]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([1]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    const insertCall = (mockParentStore.insertParents as any).mock.calls[0][0];
    expect(insertCall).toHaveLength(1);

    const addDocsCall = (mockVectorDB.addDocuments as any).mock.calls[0][0];
    expect(addDocsCall).toHaveLength(1);
    expect(addDocsCall[0].id).toBe('chunk:small.txt:1:0');
  });

  it('Test 3: Unchanged file is skipped', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'recipe.txt', content: 'unchanged content' },
    ]);
    mockComputeHash.mockReturnValue('abc123');
    mockParentStore.getAllSourceFileHashes = vi.fn().mockReturnValue([
      { sourceFile: 'recipe.txt', hash: 'abc123' },
    ]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    expect(mockParentStore.insertParents).not.toHaveBeenCalled();
    expect(mockVectorDB.addDocuments).not.toHaveBeenCalled();
    expect(mockParentStore.deleteBySourceFile).not.toHaveBeenCalled();
    expect(mockVectorDB.deleteDocuments).not.toHaveBeenCalled();
  });

  it('Test 4: Modified file deletes old data and creates new', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'recipe.txt', content: 'new content' },
    ]);
    mockComputeHash.mockReturnValue('newHash');
    mockParentStore.getAllSourceFileHashes = vi.fn().mockReturnValue([
      { sourceFile: 'recipe.txt', hash: 'oldHash' },
    ]);
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'updated parent',
        children: ['updated child'],
      },
    ]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([5]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    expect(mockParentStore.deleteBySourceFile).toHaveBeenCalledWith('recipe.txt');
    expect(mockVectorDB.deleteDocuments).toHaveBeenCalledWith({
      where: { sourceFile: 'recipe.txt' },
    });
    expect(mockParentStore.insertParents).toHaveBeenCalled();
    expect(mockVectorDB.addDocuments).toHaveBeenCalled();
  });

  it('Test 5: Deleted file removes parents and children', async () => {
    mockReadFiles.mockResolvedValue([]);
    mockParentStore.getAllSourceFileHashes = vi.fn().mockReturnValue([
      { sourceFile: 'recipe.txt', hash: 'abc123' },
    ]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    expect(mockParentStore.deleteBySourceFile).toHaveBeenCalledWith('recipe.txt');
    expect(mockVectorDB.deleteDocuments).toHaveBeenCalledWith({
      where: { sourceFile: 'recipe.txt' },
    });
    expect(mockParentStore.insertParents).not.toHaveBeenCalled();
    expect(mockVectorDB.addDocuments).not.toHaveBeenCalled();
  });

  it('Test 6: Multiple files (mix of new, unchanged, modified)', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'new.txt', content: 'new file content' },
      { fileName: 'unchanged.txt', content: 'unchanged content' },
      { fileName: 'modified.txt', content: 'modified content' },
    ]);
    mockComputeHash.mockImplementation((content: string) => {
      if (content === 'new file content') return 'newhash';
      if (content === 'unchanged content') return 'unchangedhash';
      if (content === 'modified content') return 'modifiedhash_new';
      return 'defaulthash';
    });
    mockParentStore.getAllSourceFileHashes = vi.fn().mockReturnValue([
      { sourceFile: 'unchanged.txt', hash: 'unchangedhash' },
      { sourceFile: 'modified.txt', hash: 'modifiedhash_old' },
    ]);
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'parent',
        children: ['child'],
      },
    ]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([1]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    expect(mockParentStore.insertParents).toHaveBeenCalledTimes(2);
    expect(mockVectorDB.addDocuments).toHaveBeenCalledTimes(2);

    expect(mockParentStore.deleteBySourceFile).toHaveBeenCalledWith('modified.txt');
    expect(mockVectorDB.deleteDocuments).toHaveBeenCalledWith({
      where: { sourceFile: 'modified.txt' },
    });
  });

  it('Test 7: Reset flag clears both stores', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'file.txt', content: 'content' },
    ]);
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'parent',
        children: ['child'],
      },
    ]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([1]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      true
    );

    expect(mockVectorDB.reset).toHaveBeenCalled();
    expect(mockParentStore.deleteAll).toHaveBeenCalled();
    expect(mockParentStore.insertParents).toHaveBeenCalled();
    expect(mockVectorDB.addDocuments).toHaveBeenCalled();
  });

  it('Test 8: Child IDs are deterministic', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'recipe.txt', content: 'content' },
    ]);
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'parent 1',
        children: ['child 1.1', 'child 1.2', 'child 1.3'],
      },
    ]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([42]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    const addDocsCall = (mockVectorDB.addDocuments as any).mock.calls[0][0];
    expect(addDocsCall[0].id).toBe('chunk:recipe.txt:42:0');
    expect(addDocsCall[1].id).toBe('chunk:recipe.txt:42:1');
    expect(addDocsCall[2].id).toBe('chunk:recipe.txt:42:2');
  });

  it('Test 9: Parent chunks have correct parentIndex', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'large.txt', content: 'large file content' },
    ]);
    mockChunkingService.chunk = vi.fn().mockReturnValue([
      {
        text: 'parent 1',
        children: ['child 1.1'],
      },
      {
        text: 'parent 2',
        children: ['child 2.1'],
      },
      {
        text: 'parent 3',
        children: ['child 3.1'],
      },
    ]);
    mockParentStore.insertParents = vi.fn().mockReturnValue([10, 11, 12]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    const insertCall = (mockParentStore.insertParents as any).mock.calls[0][0];
    expect(insertCall[0].parentIndex).toBe(0);
    expect(insertCall[1].parentIndex).toBe(1);
    expect(insertCall[2].parentIndex).toBe(2);
  });

  it('Test 10: Empty/whitespace file is skipped', async () => {
    mockReadFiles.mockResolvedValue([
      { fileName: 'empty.txt', content: '   \n\n   \t\t   ' },
    ]);
    mockChunkingService.chunk = vi.fn().mockReturnValue([]);

    await syncDocumentsCore(
      {
        vectorDB: mockVectorDB,
        embeddingService: mockEmbeddingService,
        chunkingService: mockChunkingService,
        parentStore: mockParentStore,
        readFiles: mockReadFiles,
        computeHash: mockComputeHash,
      },
      { documentsDir: '/test/docs' },
      false
    );

    expect(mockParentStore.insertParents).not.toHaveBeenCalled();
    expect(mockVectorDB.addDocuments).not.toHaveBeenCalled();
  });
});
