import { TextChunker } from './text-chunker.interface';

const PARAGRAPH_SEPARATOR = '\n\n';
const PARAGRAPH_SPLIT_REGEX = new RegExp(`${PARAGRAPH_SEPARATOR}+`);

export class ParagraphSentenceChunker implements TextChunker {
  chunk(content: string, chunkSize: number, chunkOverlap: number): string[] {
    if (chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0');
    }
    if (chunkOverlap >= chunkSize) {
      throw new Error('Chunk overlap must be less than chunk size');
    }
    if (chunkOverlap < 0) {
      throw new Error('Chunk overlap must be non-negative');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return [];
    }

    if (trimmedContent.length <= chunkSize) {
      return [trimmedContent];
    }

    return this.splitIntoParagraphAwareChunks(trimmedContent, chunkSize, chunkOverlap);
  }

  private splitIntoParagraphAwareChunks(
    content: string,
    chunkSize: number,
    chunkOverlap: number
  ): string[] {
    const paragraphs = content.split(PARAGRAPH_SPLIT_REGEX).filter(p => p.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      if (currentChunk.length === 0 && paragraph.length > chunkSize) {
        chunks.push(...this.splitLargeParagraph(paragraph, chunkSize));
        continue;
      }

      const separator = currentChunk.length > 0 ? PARAGRAPH_SEPARATOR : '';
      const potentialChunk = currentChunk + separator + paragraph;

      if (potentialChunk.length <= chunkSize || currentChunk.length === 0) {
        currentChunk = potentialChunk;
        continue;
      }

      chunks.push(currentChunk);
      if (paragraph.length > chunkSize) {
        chunks.push(...this.splitLargeParagraph(paragraph, chunkSize));
        currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    if (chunkOverlap > 0 && chunks.length > 1) {
      return this.applyOverlapToChunks(chunks, chunkOverlap);
    }

    return chunks;
  }

  private splitLargeParagraph(paragraph: string, chunkSize: number): string[] {
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/);

    if (sentences.length === 0) {
      sentences.push(paragraph);
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].length > chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        const hardChunks = this.hardSplitText(sentences[i], chunkSize);
        chunks.push(...hardChunks);
        continue;
      }

      const potentialChunk = currentChunk + sentences[i];
      if (potentialChunk.length <= chunkSize || currentChunk.length === 0) {
        currentChunk = potentialChunk;
        continue;
      }

      chunks.push(currentChunk);
      currentChunk = sentences[i];
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [paragraph];
  }

  private hardSplitText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private applyOverlapToChunks(chunks: string[], overlap: number): string[] {
    const overlappedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunkText = chunks[i];

      if (i > 0) {
        const previousChunk = chunks[i - 1];
        const actualOverlap = Math.min(overlap, previousChunk.length);
        const overlapText = previousChunk.slice(-actualOverlap);
        chunkText = overlapText + chunkText;
      }

      overlappedChunks.push(chunkText);
    }

    return overlappedChunks;
  }
}
