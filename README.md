# AI Cooking Assistant

A RAG (Retrieval-Augmented Generation) chatbot for your personal recipe collection. It uses Google's Gemini models for both generating embeddings and answering questions, allowing you to chat with your cookbook.

Simply drop your recipe text files into the data folder, sync, and ask questions like "I have chicken and potatoes, what can I cook?".

## Features

- **Personal Recipe Knowledge Base**: Ingests your local text (`.txt`) recipe files.
- **Smart Recommendations**: Uses semantic search to find relevant recipes based on ingredients or cravings.
- **Gemini-Powered**: Utilizes `gemini-embedding-001` for embeddings and `gemini-3-flash-preview` for generation, or you can change it to any other Gemini model in the .env file.
- **Sync**: Synchronization script that adds, updates, or deletes recipes from the vector database based on file changes.
- **Vector Search**: fast and efficient similarity search using ChromaDB.

## Prerequisites

- **Node.js**: v20+
- **ChromaDB**: A running instance of ChromaDB (e.g., via Docker).
- **Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/).

## Setup

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory. You can copy `.env.example` if it exists, but ensure you set the following variables required by the application:

   ```env
   # Server
   PORT=3000

   # Database
   CHROMA_URL=http://localhost:8000
   COLLECTION_NAME=recipes

   # Google Gemini
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_EMBEDDING_MODEL=gemini-embedding-001
   GEMINI_ASK_MODEL=gemini-3-flash-preview

   # RAG Settings
   RAG_N_RESULTS=5                          # Number of recipes to retrieve context from
   RAG_MIN_SIMILARITY=0.7                   # Minimum similarity score (0.0 to 1.0)
   DOCUMENTS_DIR=./data/documents           # Directory containing .txt recipe files
   ```

3. **Prepare Data**
   Add your .txt files to **data/documents**

4. **Sync Recipes**
   Run the synchronization script to process your text files and load them into ChromaDB:
   ```bash
   npm run sync-docs
   ```

5. **Start Server**
   ```bash
   npm run build
   npm run start
   ```

## Usage

### Ask for Advice

**Endpoint**: `POST /chatbot/ask`

**Request**:
```json
{
  "question": "I want to cook a dessert with apples. What do you have?"
}
```

**Response**:
```json
{
  "question": "I want to cook a dessert with apples. What do you have?",
  "answer": "Based on your recipes, I found 'Grandma's Apple Pie'. It requires granny smith apples, cinnamon, and..."
}
```
