export interface ParentChunkDocument {
  id: number;
  sourceFile: string;
  parentIndex: number;
  content: string;
  hash: string;
  syncedAt: number;
}

export interface ParentChunkDocumentStore {
  insertParents(parents: Omit<ParentChunkDocument, 'id'>[]): number[];

  updateParents(parents: ParentChunkDocument[]): void;

  getParents(ids: number[]): ParentChunkDocument[];

  getParentsBySourceFile(sourceFile: string): ParentChunkDocument[];

  getAllSourceFileHashes(): { sourceFile: string; hash: string }[];

  deleteBySourceFile(sourceFile: string): void;

  deleteAll(): void;
}
