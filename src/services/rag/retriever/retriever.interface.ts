export interface RetrievedEntry {
  sourceFile: string;
  content: string;
  similarity: number;
}

export interface RetrievedContext {
  entries: RetrievedEntry[];
}

export interface RetrieverService {
  retrieve(question: string): Promise<RetrievedContext>;
}
