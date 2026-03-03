import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratorService } from '../services/rag/generator/generator.interface.js';
import type { RetrieverService } from '../services/rag/retriever/retriever.interface.js';
import { registerTools } from './setup.js';

interface MockMcpServer {
  registerTool: ReturnType<typeof vi.fn>;
}

function createMockServer(): MockMcpServer {
  return { registerTool: vi.fn() };
}

function createMockServices() {
  const retrieverService: RetrieverService = {
    retrieve: vi.fn(),
  };
  const generatorService: GeneratorService = {
    generate: vi.fn(),
  };
  return { retrieverService, generatorService };
}

describe('registerTools', () => {
  let server: MockMcpServer;
  let retrieverService: RetrieverService;
  let generatorService: GeneratorService;

  beforeEach(() => {
    server = createMockServer();
    const services = createMockServices();
    retrieverService = services.retrieverService;
    generatorService = services.generatorService;
  });

  it('registers ask_recipe tool with description and question input schema', () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const askCall = calls.find((c: unknown[]) => c[0] === 'ask_recipe');

    expect(askCall).toBeDefined();
    if (!askCall) return;

    const config = askCall[1];
    expect(config.description).toBeTruthy();
    expect(config.inputSchema).toBeDefined();
    expect(config.inputSchema.question).toBeDefined();
  });

  it('registers search_recipes tool with description and question input schema', () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const searchCall = calls.find((c: unknown[]) => c[0] === 'search_recipes');

    expect(searchCall).toBeDefined();
    if (!searchCall) return;

    const config = searchCall[1];
    expect(config.description).toBeTruthy();
    expect(config.inputSchema).toBeDefined();
    expect(config.inputSchema.question).toBeDefined();
  });

  it('ask_recipe handler returns text content from generatorService.generate', async () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const askCall = calls.find((c: unknown[]) => c[0] === 'ask_recipe');
    if (!askCall) throw new Error('ask_recipe not registered');
    const handler = askCall[2];

    vi.mocked(generatorService.generate).mockResolvedValue(
      'Pasta cooks in 10 minutes.',
    );

    const result = await handler({ question: 'How to cook pasta?' });

    expect(generatorService.generate).toHaveBeenCalledWith(
      'How to cook pasta?',
    );
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Pasta cooks in 10 minutes.' }],
    });
  });

  it('ask_recipe handler returns isError true when generatorService.generate throws', async () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const askCall = calls.find((c: unknown[]) => c[0] === 'ask_recipe');
    if (!askCall) throw new Error('ask_recipe not registered');
    const handler = askCall[2];

    vi.mocked(generatorService.generate).mockRejectedValue(
      new Error('LLM timeout'),
    );

    const result = await handler({ question: 'How to cook pasta?' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: LLM timeout' }],
      isError: true,
    });
  });

  it('search_recipes handler returns formatted text entries from retrieverService.retrieve', async () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const searchCall = calls.find((c: unknown[]) => c[0] === 'search_recipes');
    if (!searchCall) throw new Error('search_recipes not registered');
    const handler = searchCall[2];

    vi.mocked(retrieverService.retrieve).mockResolvedValue({
      entries: [
        {
          sourceFile: 'pasta.txt',
          content: 'Cook pasta al dente.',
          similarity: 0.91,
        },
        {
          sourceFile: 'sauce.txt',
          content: 'Simmer sauce for 20 minutes.',
          similarity: 0.85,
        },
      ],
    });

    const result = await handler({ question: 'pasta' });

    expect(retrieverService.retrieve).toHaveBeenCalledWith('pasta');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('pasta.txt');
    expect(result.content[0].text).toContain('0.91');
    expect(result.content[0].text).toContain('Cook pasta al dente.');
    expect(result.content[0].text).toContain('sauce.txt');
  });

  it('search_recipes handler returns empty results message when no entries found', async () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const searchCall = calls.find((c: unknown[]) => c[0] === 'search_recipes');
    if (!searchCall) throw new Error('search_recipes not registered');
    const handler = searchCall[2];

    vi.mocked(retrieverService.retrieve).mockResolvedValue({ entries: [] });

    const result = await handler({ question: 'unicorn recipe' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'No matching recipes found.' }],
    });
  });

  it('search_recipes handler returns isError true when retrieverService.retrieve throws', async () => {
    registerTools(server as never, { retrieverService, generatorService });

    const calls = server.registerTool.mock.calls;
    const searchCall = calls.find((c: unknown[]) => c[0] === 'search_recipes');
    if (!searchCall) throw new Error('search_recipes not registered');
    const handler = searchCall[2];

    vi.mocked(retrieverService.retrieve).mockRejectedValue(
      new Error('DB unavailable'),
    );

    const result = await handler({ question: 'pasta' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: DB unavailable' }],
      isError: true,
    });
  });
});
