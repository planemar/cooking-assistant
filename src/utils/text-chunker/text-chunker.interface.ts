export interface TextChunker {
  /**
   * Splits text into chunks with optional overlap.
   *
   * @param content - The text to split
   * @param chunkSize - Target size for chunks
   * @param chunkOverlap - Number of characters to overlap between consecutive chunks
   * @returns Array of text chunks
   */
  chunk(content: string, chunkSize: number, chunkOverlap: number): string[];
}
