# MCP Knowledge Graph

A modular Memory and Cognition Platform Knowledge Graph system for AI applications, providing persistent memory, hierarchical organization, and advanced search capabilities.

## Features

- **Entity Management**: Create, read, update, and delete entities with observations
- **Relation Management**: Define relationships between entities
- **Project Management**: Organize entities into projects
- **Tag System**: Flexible categorization with tags
- **Hierarchical Memory**: Support for parent-child relationships
- **Advanced Search**: Search by name, type, tags, and hierarchical relationships
- **Memory Health**: Tools for monitoring and maintaining memory health

## Installation

```bash
git clone https://github.com/your-username/mcp-knowledge-graph.git
cd mcp-knowledge-graph
npm install
npm run build
```

## Usage

Start the server:

```bash
npm start
```

The server runs on port 3000 by default. You can customize the port by setting the `PORT` environment variable.

## API Endpoints

### Entity Management

- `POST /entities`: Create a new entity
- `GET /entities/:name`: Retrieve an entity
- `PUT /entities/:name`: Update an entity
- `DELETE /entities/:name`: Delete an entity

### Relation Management

- `POST /relations`: Create a relation between entities
- `GET /relations`: Retrieve relations for an entity
- `DELETE /relations`: Delete a relation

### Project Management

- `POST /projects`: Create a new project
- `GET /projects`: List all projects
- `GET /projects/:projectId`: Retrieve a project
- `PUT /projects/:projectId`: Update a project
- `DELETE /projects/:projectId`: Delete a project
- `GET /projects/:projectId/entities`: Retrieve entities for a project
- `POST /set-current-project`: Set the current active project
- `GET /current-project`: Get the current active project
- `GET /recent-projects`: Get recently accessed projects

### Tag Management

- `POST /entities/:name/tags`: Add tags to an entity
- `DELETE /entities/:name/tags`: Remove tags from an entity
- `GET /tags`: Get all tags
- `GET /tags/:tag/entities`: Get entities with a specific tag
- `GET /tags/:tag/related`: Get related tags

### Search

- `POST /search`: Search with filters
- `POST /advanced-search`: Advanced search with multiple criteria
- `GET /search/name/:name`: Search entities by name
- `GET /search/type/:type`: Search entities by type
- `GET /search/hierarchical/:rootEntity`: Hierarchical search
- `GET /search/relation/:relationType`: Search by relation type

### Memory Health

- `GET /memory-health`: Get memory health metrics
- `GET /memory-health/duplicates`: Find possible duplicate entities
- `GET /memory-health/stale`: Find stale entities
- `GET /memory-health/orphaned`: Find orphaned entities
- `POST /deprecate-entity/:name`: Deprecate an entity

## Project Structure

```
src/
  ├── core/
  │   ├── KnowledgeGraphManager.ts   # Core functionality
  │   └── utils.ts                   # Utility functions
  ├── types/
  │   └── interfaces.ts              # TypeScript interfaces
  ├── managers/
  │   ├── ProjectManager.ts          # Project management
  │   ├── TagManager.ts              # Tag management
  │   ├── SearchManager.ts           # Search functionality
  │   └── MemoryHealthManager.ts     # Memory health
  ├── server/
  │   └── server.ts                  # Express server
  └── index.ts                       # Entry point
```

## Configuration

The server can be configured with the following environment variables:

- `PORT`: The port to run the server on (default: 3000)
- `MEMORY_FILE`: Path to the memory file (default: './memory.jsonl')
- `WORKING_MEMORY_FILE`: Path to the working memory file (default: './working_memory.json')

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Model Context Protocol Integration

This server uses the Model Context Protocol (MCP) to integrate with Claude Desktop. Instead of running as a traditional HTTP server, it communicates via stdin/stdout using JSON-RPC formatted messages.

### Registering with Claude Desktop

To register this server with Claude Desktop, add the following configuration to your Claude Desktop settings:

```json
"memory": {
  "command": "node",
  "args": [
    "/path/to/dist/index.js",
    "--memory-path", 
    "/path/to/memory.jsonl"
  ]
}
```

**Important**: The server MUST be registered as `memory` (not "knowledge-graph" or "mcp-knowledge-graph") for Claude Desktop to recognize it correctly.

### Available MCP Functions

The server exposes the following MCP functions:

| Function | Description |
|----------|-------------|
| `read_graph` | Get a lightweight overview of all entities and relations in the graph |
| `create_entities` | Create new entities |
| `create_relations` | Create new relations between entities |
| `add_observations` | Add observations to existing entities |
| `search_nodes` | Search for entities by keyword |
| `open_nodes` | Get full details of specific entities by name |
| `get_recent_entities` | Get recently accessed entities |
| `get_working_memory` | Get the current working memory context |
| `set_current_topic` | Set the current conversation topic |
