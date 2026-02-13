import { TextChunker } from './text-chunker.interface';

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
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    const chunks: string[] = [];
    let i = 0;

    while (i < paragraphs.length) {
      let currentChunk = '';

      while (i < paragraphs.length) {
        const nextParagraph = paragraphs[i];
        const separator = currentChunk.length > 0 ? '\n\n' : '';
        const potentialChunk = currentChunk + separator + nextParagraph;

        if (currentChunk.length === 0 && nextParagraph.length > chunkSize) {
          const sentenceChunks = this.splitLargeParagraph(nextParagraph, chunkSize);
          chunks.push(...sentenceChunks);
          i++;
          break;
        }

        if (potentialChunk.length > chunkSize && currentChunk.length > 0) {
          break;
        }

        currentChunk = potentialChunk;
        i++;
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
    }

    if (chunkOverlap > 0 && chunks.length > 1) {
      return this.applyOverlapToChunks(chunks, chunkOverlap);
    }

    return chunks;
  }

  private splitLargeParagraph(paragraph: string, chunkSize: number): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    for (let i = 0; i < paragraph.length; i++) {
      currentSentence += paragraph[i];

      if (i < paragraph.length - 1) {
        const char = paragraph[i];
        const nextChar = paragraph[i + 1];

        if (['.', '?', '!'].includes(char)) {
          if (nextChar === ' ' || nextChar === '\n') {
            let j = i + 1;
            while (j < paragraph.length && (paragraph[j] === ' ' || paragraph[j] === '\n')) {
              currentSentence += paragraph[j];
              j++;
            }
            if (j < paragraph.length && /[A-Z]/.test(paragraph[j])) {
              sentences.push(currentSentence);
              currentSentence = '';
              i = j - 1;
            }
          }
        }
      }
    }

    if (currentSentence.trim().length > 0) {
      sentences.push(currentSentence);
    }

    if (sentences.length === 0) {
      sentences.push(paragraph);
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (sentence.length > chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        const hardChunks = this.hardSplitText(sentence, chunkSize);
        chunks.push(...hardChunks);
        continue;
      }

      const potentialChunk = currentChunk + sentence;
      if (potentialChunk.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk = potentialChunk;
      }
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
        const overlapText = previousChunk.slice(-overlap);
        chunkText = overlapText + chunkText;
      }

      overlappedChunks.push(chunkText);
    }

    return overlappedChunks;
  }
}
