import express, { Request, Response } from 'express';
import { RAGService } from '../services/rag';
import { logger } from '../utils/logger';

export function createServer(ragService: RAGService): express.Application {
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

      const answer = await ragService.ask(question);

      logger.info(`[Answer] ${answer}`);

      res.json({
        question,
        answer,
      });
    } catch (error) {
      logger.error('Error processing question', error instanceof Error ? error : undefined);

      res.status(500).json({
        error: 'An error occurred while processing your question',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/health', (_req: Request, res: Response) => {
    // TODO: dummy check for now, replace with a proper health check
    // e.g. check DB connection and Gemini API access 
    res.json({ status: 'ok' });
  });

  return app;
}