# AI Chatbot Learning

An educational AI chatbot project implementing Retrieval-Augmented Generation (RAG) using Gemini embeddings, ChromaDB vector database, and Claude Haiku via AgentRouter.

## Features

- **Vector Database**: Local ChromaDB storage for document embeddings
- **Smart Embeddings**: Gemini text-embedding-004 model for semantic search
- **RAG**: Claude Haiku 4.5 via AgentRouter for intelligent question answering
- **Document Sync**: Automatic synchronization of company guides from text files
- **Hash-based Updates**: Efficient detection of document changes using SHA-256
- **RESTful API**: Simple HTTP endpoint for chatbot interactions

## Architecture

```
src/
├── api/                  # HTTP server
│   └── server.ts
├── services/             # Core services
│   ├── vector-db/        # Vector database abstraction
│   ├── embedding/        # Embedding service
│   └── rag/              # RAG implementation
├── scripts/              # Utility scripts
│   └── sync-docs.ts      # Document synchronization
└── index.ts              # Application entry point

data/
└── documents/            # Company guide text files
```

## Prerequisites

- Node.js 20+ LTS
- Gemini API key (https://makersuite.google.com/app/apikey)
- AgentRouter API key (https://agentrouter.org)

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

   Update the following in `.env`:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `AGENTROUTER_API_KEY`: Your AgentRouter API key
   - `AGENTROUTER_MODEL`: Model to use (default: claude-haiku-4-5-20251001)
   - `PORT`: Server port (e.g., 3000)
   - Other configuration as needed

3. **Add your company documents**:
   Place `.txt` files in `data/documents/` directory

4. **Sync documents to vector database**:
   ```bash
   npm run sync-docs
   ```

5. **Start the server**:
   ```bash
   npm run dev
   ```

## Usage

### Ask a Question

```bash
curl -X POST http://localhost:3000/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the company values?"}'
```

Response:
```json
{
  "question": "What are the company values?",
  "answer": "Based on the company documentation, TechVenture Inc. has four core values: Innovation..."
}
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled production build
- `npm run sync-docs` - Sync documents to vector database

## Configuration

All configuration is managed through environment variables in `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Gemini API key | `your_api_key` |
| `GEMINI_EMBEDDING_MODEL` | Embedding model name | `text-embedding-004` |
| `AGENTROUTER_API_KEY` | AgentRouter API key | `your_api_key` |
| `AGENTROUTER_MODEL` | LLM model for RAG | `claude-haiku-4-5-20251001` |
| `PORT` | Server port | `3000` |
| `CHROMA_PATH` | ChromaDB storage path | `./chroma_db` |
| `COLLECTION_NAME` | Vector DB collection | `company_guides` |
| `DOCUMENTS_DIR` | Documents directory | `./data/documents` |
| `RAG_N_RESULTS` | Max documents to retrieve | `5` |
| `RAG_MIN_SIMILARITY` | Similarity threshold (0-1) | `0.7` |

## How It Works

1. **Document Ingestion**: Text files from `data/documents/` are read and hashed
2. **Embedding Generation**: Gemini creates vector embeddings for each document
3. **Vector Storage**: Embeddings are stored in local ChromaDB
4. **Question Processing**: User questions are embedded using the same model
5. **Similarity Search**: ChromaDB finds the most relevant documents
6. **Answer Generation**: Claude Haiku generates answers based on retrieved context

## Project Structure

### Services

- **VectorDBService**: Abstraction for vector database operations
  - Implementation: ChromaVectorDBService
- **EmbeddingService**: Abstraction for text embedding
  - Implementation: GeminiEmbeddingService
- **RAGService**: Abstraction for RAG functionality
  - Implementation: AgentRouterRAGService

### Document Sync

The sync script (`sync-docs.ts`) intelligently manages your document collection:
- **Add**: New files are embedded and added to the database
- **Update**: Modified files (detected via hash) are re-embedded
- **Delete**: Removed files are deleted from the database

## Development

Built with modern TypeScript best practices:
- Interface-based abstractions for flexibility
- Dependency injection for testability
- Factory pattern for service initialization
- Environment-based configuration

## License

ISC
