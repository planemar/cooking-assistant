# AI Cooking Assistant

A RAG (Retrieval-Augmented Generation) chatbot for your personal recipe collection. Drop recipe `.txt` files into a folder, sync them, and ask questions about your recipes through a REST API.

Powered by Google Gemini for embeddings and answer generation, ChromaDB for vector search, and SQLite for parent chunk storage.

## Features

- **Parent-child chunking** - Documents are split into parent chunks (stored in SQLite) and smaller child chunks (embedded and stored in ChromaDB). Queries match against precise child chunks, then retrieve full parent context for richer answers.
- **Incremental sync** - Only new or modified files are re-processed. Deleted files are cleaned up automatically from both stores.
- **MCP server** - Exposes `ask_recipe` and `search_recipes` tools via the Model Context Protocol, supporting both stdio transport and Streamable HTTP transport (`POST /mcp`).

## Prerequisites

- Node.js v20+
- ChromaDB server running (default: `http://localhost:8000`)
- A `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `GEMINI_API_KEY`. See `.env.example` for all available settings.

3. **Add recipes**

   Place your `.txt` recipe files in `data/documents/`.

4. **Sync recipes**
   ```bash
   npm run sync-docs
   ```

5. **Start the server**
   ```bash
   npm run build
   npm run start
   ```

## Usage

```bash
curl -X POST http://localhost:3000/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I make chicken katsu curry?"}'
```

Response:
```json
{
  "question": "How do I make chicken katsu curry?",
  "answer": "Based on your recipes, here's how to make Chicken Katsu Curry..."
}
```

### Syncing

```bash
npm run sync-docs              # Incremental sync (add/update/delete)
npm run sync-docs -- --reset   # Full reset and re-sync from scratch
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chatbot/ask` | POST | Takes `{ "question": "..." }`, returns `{ "question", "answer" }` |
| `/mcp` | POST | MCP Streamable HTTP endpoint (stateless, JSON-RPC) |
| `/health` | GET | Health check |

## MCP Server

The assistant is also available as an [MCP](https://modelcontextprotocol.io/) server, exposing two tools:

| Tool | Description |
|------|-------------|
| `ask_recipe` | Ask a cooking question — runs full RAG pipeline (retrieve + generate) and returns the answer |
| `search_recipes` | Search recipes — runs retrieval only and returns matching entries with source file, similarity score, and content |

### Stdio transport (local MCP clients)

For local MCP clients that communicate over stdin/stdout:

```bash
npm run mcp             # Dev mode (tsx)
npm run mcp:start       # Production (compiled)
```

### HTTP transport (remote MCP clients)

Start the server normally (`npm run dev` or `npm start`) and point your MCP client to:

```
http://localhost:3000/mcp
```

## Development

```bash
npm run dev          # Dev server with hot reload
npm run build        # Compile TypeScript
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run check        # Lint with Biome
npm run check:fix    # Lint and auto-fix
npm run mcp          # MCP stdio server (dev mode)
npm run mcp:start    # MCP stdio server (production)
```

## Configuration

All configuration is via environment variables (validated on startup). Key settings:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `CHROMA_URL` | ChromaDB server URL |
| `SQLITE_DB_PATH` | SQLite database file path (default: `./data/parents.db`) |
| `CHILD_CHUNK_SIZE` | Child chunk size in characters (default: 500) |
| `CHILD_CHUNK_OVERLAP_FACTOR` | Child overlap size as multiple of child size (default: 0.2) |
| `PARENT_CHUNK_SIZE_FACTOR` | Parent size as multiple of child size (default: 5) |
| `RAG_N_RESULTS` | Max results to retrieve per query (default: 5) |
| `RAG_MIN_SIMILARITY` | Minimum similarity threshold 0-1 (default: 0.7) |

See `.env.example` for the complete list.

## Tech Stack

TypeScript, ChromaDB, SQLite, Google Gemini, Vitest, Biome
