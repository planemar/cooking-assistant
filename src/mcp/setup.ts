import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GeneratorService } from '../services/rag/generator/generator.interface.js';
import type { RetrieverService } from '../services/rag/retriever/retriever.interface.js';
import { logger } from '../utils/logger.js';

interface McpServices {
  retrieverService: RetrieverService;
  generatorService: GeneratorService;
}

export function registerTools(server: McpServer, services: McpServices): void {
  server.registerTool(
    'ask_recipe',
    {
      title: 'Ask Recipe',
      description:
        'Ask a cooking question and get an AI-generated answer based on your recipe collection',
      inputSchema: {
        question: z.string().describe('The cooking question to answer'),
      },
    },
    async ({ question }) => {
      try {
        const answer = await services.generatorService.generate(question);
        return {
          content: [{ type: 'text' as const, text: answer }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          'ask_recipe tool error',
          error instanceof Error ? error : undefined,
        );
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'search_recipes',
    {
      title: 'Search Recipes',
      description:
        'Search your recipe collection for relevant content without generating an answer',
      inputSchema: {
        question: z
          .string()
          .describe('The search query for finding relevant recipes'),
      },
    },
    async ({ question }) => {
      try {
        const { entries } = await services.retrieverService.retrieve(question);

        if (entries.length === 0) {
          return {
            content: [
              { type: 'text' as const, text: 'No matching recipes found.' },
            ],
          };
        }

        const parts: string[] = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          parts.push(
            `[${i + 1}] Source: ${entry.sourceFile} (similarity: ${entry.similarity.toFixed(2)})\n${entry.content}`,
          );
        }

        return {
          content: [{ type: 'text' as const, text: parts.join('\n\n') }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          'search_recipes tool error',
          error instanceof Error ? error : undefined,
        );
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
