export interface ParentChunkDocument {
  id: number;
  sourceFile: string;
  parentIndex: number;
  content: string;
  hash: string;
  syncedAt: number;
}

export interface ParentChunkDocumentStore {
  insertParents(parents: Omit<ParentChunkDocument, 'id'>[]): Promise<number[]>;

  updateParents(parents: ParentChunkDocument[]): Promise<void>;

  getParents(ids: number[]): Promise<ParentChunkDocument[]>;

  getParentsBySourceFile(sourceFile: string): Promise<ParentChunkDocument[]>;

  getAllSourceFileHashes(): Promise<{ sourceFile: string; hash: string }[]>;

  deleteBySourceFile(sourceFile: string): Promise<void>;

  deleteAll(): Promise<void>;

  close(): Promise<void>;
}
