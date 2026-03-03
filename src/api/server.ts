import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import { registerTools } from '../mcp/setup.js';
import type { GeneratorService } from '../services/rag/generator/generator.interface.js';
import type { RetrieverService } from '../services/rag/retriever/retriever.interface.js';
import { logger } from '../utils/logger.js';

const MCP_SERVER_NAME = 'cooking-assistant';
const MCP_SERVER_VERSION = '1.0.0';

export function createServer(
  generatorService: GeneratorService,
  retrieverService: RetrieverService,
): express.Application {
  const app = express();

  app.use(express.json());

  app.post('/chatbot/ask', async (req: Request, res: Response) => {
    try {
      const { question } = req.body;

      if (!question || typeof question !== 'string' || question.trim() === '') {
        res.status(400).json({
          error: 'Question is required and must be a non-empty string',
        });
        return;
      }

      logger.info(`[Question] ${question}`);

      const answer = await generatorService.generate(question);

      logger.info(`[Answer] ${answer}`);

      res.json({
        question,
        answer,
      });
    } catch (error) {
      logger.error(
        'Error processing question',
        error instanceof Error ? error : undefined,
      );

      res.status(500).json({
        error: 'An error occurred while processing your question',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
      });

      registerTools(server, { retrieverService, generatorService });

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(
        'MCP request error',
        error instanceof Error ? error : undefined,
      );
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP request failed' });
      }
    }
  });

  return app;
}
