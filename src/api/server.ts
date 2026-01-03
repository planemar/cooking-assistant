import express, { Request, Response } from 'express';
import { AgentRouterRAGService } from '../services/rag';

export function createServer(ragService: AgentRouterRAGService): express.Application {
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

      console.log(`\n[Question] ${question}`);

      const answer = await ragService.ask(question);

      console.log(`[Answer] ${answer}\n`);

      res.json({
        question,
        answer,
      });
    } catch (error) {
      console.error('Error processing question:', error);

      res.status(500).json({
        error: 'An error occurred while processing your question',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return app;
}