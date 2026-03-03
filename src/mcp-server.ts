import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './mcp/setup.js';
import { initializeServices } from './services/init.js';
import { logger } from './utils/logger.js';

const MCP_SERVER_NAME = 'cooking-assistant';
const MCP_SERVER_VERSION = '1.0.0';

async function main() {
  logger.useStderr();

  try {
    const { retrieverService, generatorService, parentChunkStore } =
      await initializeServices();

    const server = new McpServer({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    });

    registerTools(server, { retrieverService, generatorService });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP server running on stdio');

    const shutdown = async () => {
      logger.info('Shutting down MCP server...');
      await server.close();
      await parentChunkStore.close();
      logger.info('MCP server shut down');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error(
      'Failed to start MCP server',
      error instanceof Error ? error : undefined,
    );
    process.exit(1);
  }
}

main();
