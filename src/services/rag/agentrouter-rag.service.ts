import { VectorDBService } from '../vector-db';
import { EmbeddingService } from '../embedding';
import { RAGService } from './rag.interface';
import { logger } from '../../utils/logger';

const AGENTROUTER_API_URL = 'https://api.agentrouter.org/v1/chat/completions';

const PROMPT_TEMPLATE = `You are a helpful assistant that answers questions based on the provided company documentation.

Context from company guides:
{context}

User question: {question}

Instructions:
- Answer the question using only the information provided in the context above
- If the context doesn't contain enough information to answer the question, say so clearly
- Be concise and accurate
- Reference specific documents when applicable

Answer:`;

const NO_RESULTS_MESSAGE = 'I could not find any relevant information in the company guides to answer your question.';

export interface AgentRouterRAGConfig {
  /** AgentRouter API key */
  apiKey: string;

  /** Model name to use via AgentRouter */
  modelName: string;

  /** Number of documents to retrieve for context */
  nResults: number;

  /** Minimum similarity threshold for retrieved documents (0-1) */
  minSimilarity: number;
}

export class AgentRouterRAGService implements RAGService {
  private vectorDB: VectorDBService;
  private embedding: EmbeddingService;
  private apiKey: string;
  private modelName: string;
  private nResults: number;
  private minSimilarity: number;

  private constructor(
    vectorDB: VectorDBService,
    embedding: EmbeddingService,
    apiKey: string,
    modelName: string,
    nResults: number,
    minSimilarity: number
  ) {
    this.vectorDB = vectorDB;
    this.embedding = embedding;
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.nResults = nResults;
    this.minSimilarity = minSimilarity;
  }

  static create(
    vectorDB: VectorDBService,
    embedding: EmbeddingService,
    config: AgentRouterRAGConfig
  ): AgentRouterRAGService {
    const { apiKey, modelName, nResults, minSimilarity } = config;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('apiKey is required and cannot be empty');
    }

    if (!modelName || modelName.trim() === '') {
      throw new Error('modelName is required and cannot be empty');
    }

    if (nResults <= 0) {
      throw new Error('nResults must be greater than 0');
    }

    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error('minSimilarity must be between 0 and 1');
    }

    logger.info(`✓ Initialized AgentRouter RAG service with model: ${modelName}`);

    return new AgentRouterRAGService(vectorDB, embedding, apiKey, modelName, nResults, minSimilarity);
  }

  async ask(question: string): Promise<string> {
    if (!question || question.trim() === '') {
      throw new Error('question is required and cannot be empty');
    }

    const questionEmbedding = await this.embedding.embed(question);
    const matches = await this.vectorDB.query(questionEmbedding, this.nResults, this.minSimilarity);

    if (matches.length === 0) {
      return NO_RESULTS_MESSAGE;
    }

    const context = matches
      .map((match, index) => `[Document ${index + 1}] (Similarity: ${match.similarity.toFixed(2)})\n${match.document}`)
      .join('\n\n');

    const prompt = this.buildPrompt(question, context);
    const response = await this.callAgentRouter(prompt);

    return response;
  }

  private buildPrompt(question: string, context: string): string {
    return PROMPT_TEMPLATE.replace('{context}', context).replace('{question}', question);
  }

  private async callAgentRouter(prompt: string): Promise<string> {
    const response = await fetch(AGENTROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AgentRouter API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response format from AgentRouter API');
    }

    return data.choices[0].message.content;
  }
}