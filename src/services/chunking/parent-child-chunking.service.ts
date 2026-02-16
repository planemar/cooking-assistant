import type { TextChunker } from '../../utils/text-chunker/text-chunker.interface';

export interface ParentChunkResult {
  text: string;
  children: string[];
}

export interface ParentChildChunkingConfig {
  childChunkSize: number;
  childChunkOverlapFactor: number;
  parentChunkSizeFactor: number;
}

export class ParentChildChunkingService {
  private constructor(
    private readonly textChunker: TextChunker,
    private readonly childChunkSize: number,
    private readonly childChunkOverlap: number,
    private readonly parentChunkSize: number,
  ) {}

  static create(
    textChunker: TextChunker,
    config: ParentChildChunkingConfig,
  ): ParentChildChunkingService {
    if (config.childChunkSize <= 0) {
      throw new Error('childChunkSize must be > 0');
    }

    if (
      config.childChunkOverlapFactor <= 0 ||
      config.childChunkOverlapFactor >= 1
    ) {
      throw new Error('childChunkOverlapFactor must be > 0 and < 1');
    }

    if (config.parentChunkSizeFactor < 1) {
      throw new Error('parentChunkSizeFactor must be >= 1');
    }

    const parentChunkSize = Math.floor(
      config.childChunkSize * config.parentChunkSizeFactor,
    );
    const childChunkOverlap = Math.floor(
      config.childChunkSize * config.childChunkOverlapFactor,
    );

    return new ParentChildChunkingService(
      textChunker,
      config.childChunkSize,
      childChunkOverlap,
      parentChunkSize,
    );
  }

  chunk(content: string): ParentChunkResult[] {
    if (!content || content.trim().length === 0) {
      return [];
    }

    const parentChunks = this.textChunker.chunk(
      content,
      this.parentChunkSize,
      0,
    );

    const results: ParentChunkResult[] = [];
    for (let i = 0; i < parentChunks.length; i++) {
      const parentText = parentChunks[i];
      const childChunks = this.textChunker.chunk(
        parentText,
        this.childChunkSize,
        this.childChunkOverlap,
      );

      results.push({
        text: parentText,
        children: childChunks,
      });
    }

    return results;
  }
}
