export interface TextChunker {
  /** Split text into chunks. overlap=0 for no overlap. */
  chunk(content: string, chunkSize: number, chunkOverlap: number): string[];
}
