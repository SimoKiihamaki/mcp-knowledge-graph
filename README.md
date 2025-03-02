# Knowledge Graph Memory Server

An improved implementation of persistent memory using a local knowledge graph with a customizable `--memory-path`.

This lets Claude remember information about the user across chats.

> [!NOTE]
> This is a fork of the original [Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) and is intended to not use the ephemeral memory npx installation method.

## Server Name

```txt
mcp-knowledge-graph
```

![screen-of-server-name](img/server-name.png)

![read-function](/img/read-function.png)

## Enhanced Memory Features

This version includes several enhancements to improve AI model's memory management:

### Context Window Optimization
- By default, `read_graph` now returns only entity names and types to save context window space
- Full entity details including observations can still be retrieved when needed

### Temporal Awareness
- All entities and relations now include timestamps for creation and last access
- Entity access counters track usage patterns over time

### Working Memory Context
- A separate working memory context tracks recently accessed entities
- Maintains a list of active entities in the current conversation
- Ranks entities by relevance based on access patterns

### Memory Triggers
- Automatic detection of when memory functions should be used
- Identifies patterns in user messages that indicate memory operations

### Documentation Guidelines
- Built-in standards for entity naming conventions
- Guidelines for effective observation formatting
- Documentation on what information should/shouldn't be stored

### Function Usage Guidelines
- Clear instructions for when to use each memory function
- Best practices for memory operations
- Example usage patterns for each function

### AI Memory Guide
- A comprehensive guide for AI models on effective memory usage
- Practical examples of memory operations
- Decision-making framework for information storage

## Core Concepts

### Entities

Entities are the primary nodes in the knowledge graph. Each entity has:

- A unique name (identifier)
- An entity type (e.g., "person", "organization", "event")
- A list of observations
- Temporal metadata (creation time, last access time)
- Usage counters (access count, relevance score)

Example:

```json
{
  "name": "John_Smith",
  "entityType": "person",
  "observations": ["Speaks fluent Spanish"],
  "createdAt": "2025-03-01T12:34:56Z",
  "lastAccessed": "2025-03-02T09:45:22Z",
  "accessCount": 5,
  "relevanceScore": 1.5
}
```

### Relations

Relations define directed connections between entities. They are always stored in active voice and describe how entities interact or relate to each other.

Example:

```json
{
  "from": "John_Smith",
  "to": "Anthropic",
  "relationType": "works_at",
  "createdAt": "2025-03-01T12:36:12Z",
  "lastAccessed": "2025-03-02T09:45:22Z",
  "metadata": {
    "confidence": 1.0,
    "source": "user_input"
  }
}
```

### Observations

Observations are discrete pieces of information about an entity. They are:

- Stored as strings
- Attached to specific entities
- Can be added or removed independently
- Should be atomic (one fact per observation)

Example:

```json
{
  "entityName": "John_Smith",
  "observations": [
    "Speaks fluent Spanish",
    "Graduated in 2019",
    "Prefers morning meetings"
  ]
}
```

### Working Memory Context

The working memory context tracks the current conversation state:

```json
{
  "activeEntities": ["John_Smith", "project_Dashboard"],
  "recentlyDiscussed": [
    {
      "entity": "John_Smith",
      "timestamp": "2025-03-02T09:45:22Z",
      "relevanceScore": 1.5
    }
  ],
  "currentTopic": "project planning",
  "pendingInformation": [],
  "lastUpdated": "2025-03-02T09:45:22Z"
}
```

## API

### Core Tools

- **create_entities**
  - Create multiple new entities in the knowledge graph
  - Input: `entities` (array of objects)
    - Each object contains:
      - `name` (string): Entity identifier
      - `entityType` (string): Type classification
      - `observations` (string[]): Associated observations
  - Ignores entities with existing names
  - Automatically adds timestamps and initializes usage counters

- **create_relations**
  - Create multiple new relations between entities
  - Input: `relations` (array of objects)
    - Each object contains:
      - `from` (string): Source entity name
      - `to` (string): Target entity name
      - `relationType` (string): Relationship type in active voice
  - Skips duplicate relations
  - Automatically adds timestamps and metadata

- **add_observations**
  - Add new observations to existing entities
  - Input: `observations` (array of objects)
    - Each object contains:
      - `entityName` (string): Target entity
      - `contents` (string[]): New observations to add
  - Returns added observations per entity
  - Fails if entity doesn't exist
  - Updates access timestamps and counters

- **delete_entities**
  - Remove entities and their relations
  - Input: `entityNames` (string[])`
  - Cascading deletion of associated relations
  - Silent operation if entity doesn't exist
  - Updates working memory context

- **delete_observations**
  - Remove specific observations from entities
  - Input: `deletions` (array of objects)
    - Each object contains:
      - `entityName` (string): Target entity
      - `observations` (string[]): Observations to remove
  - Silent operation if observation doesn't exist
  - Updates access timestamps

- **delete_relations**
  - Remove specific relations from the graph
  - Input: `relations` (array of objects)
    - Each object contains:
      - `from` (string): Source entity name
      - `to` (string): Target entity name
      - `relationType` (string): Relationship type
  - Silent operation if relation doesn't exist

- **read_graph**
  - Read the knowledge graph with optimized output
  - Input: `fullDetails` (boolean, optional)
    - When false (default): Returns only entity names and types
    - When true: Returns complete graph with all observations
  - Optimized for context window efficiency

- **search_nodes**
  - Search for nodes based on query
  - Input: `query` (string)
  - Searches across:
    - Entity names
    - Entity types
    - Observation content
  - Returns matching entities and their relations
  - Updates access timestamps and relevance scores

- **open_nodes**
  - Retrieve specific nodes by name
  - Input: `names` (string[])`
  - Returns:
    - Requested entities
    - Relations between requested entities
  - Silently skips non-existent nodes
  - Updates access timestamps and relevance scores

### Enhanced Memory Tools

- **get_recent_entities**
  - Get the most recently accessed entities
  - Input: `limit` (number, optional, default: 5)
  - Returns entities sorted by last access time

- **get_relevant_entities**
  - Get the most relevant entities for the current conversation
  - Input: `limit` (number, optional, default: 5)
  - Returns entities based on relevance scores from working memory

- **get_function_guidelines**
  - Get usage guidelines for memory functions
  - Input: `functionName` (string, optional)
  - Returns guidelines for when to use functions

- **get_documentation_standards**
  - Get standards for documenting information
  - Returns guidelines for entity naming and observation formatting

- **get_working_memory**
  - Get the current working memory context
  - Returns active entities, recently discussed topics, and current topic

- **set_current_topic**
  - Set the current conversation topic
  - Input: `topic` (string)
  - Updates working memory context

- **process_user_message**
  - Process a user message to detect memory triggers
  - Input: `message` (string)
  - Returns detected trigger types (retrieve, store, update)

## Usage with Claude Desktop

### Setup

Add this to your claude_desktop_config.json:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ]
    }
  }
}
```

### Custom Memory Path

You can specify a custom path for the memory file:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory", "--memory-path", "/path/to/your/memory.jsonl"]
    }
  }
}
```

If no path is specified, it will default to memory.jsonl in the server's installation directory.

### System Prompt for Enhanced Memory

Here's an example system prompt that takes advantage of the enhanced memory features:

```
Follow these steps for each interaction:

1. User Identification and Context Setup:
   - At the beginning of the conversation, retrieve the working memory context with get_working_memory
   - Get relevant entities with get_relevant_entities
   - Process the user's first message with process_user_message to detect memory operations

2. Smart Memory Retrieval:
   - Instead of loading all memory, use search_nodes for specific topics
   - For known entities, use open_nodes to get full details
   - Remember that read_graph only returns names and types by default

3. Memory Maintenance:
   - Follow the documentation standards from get_documentation_standards
   - Use function guidelines from get_function_guidelines to make decisions
   - Track the current conversation topic with set_current_topic

4. Information Prioritization:
   - Not everything needs to be stored - refer to the AI_MEMORY_GUIDE.md for guidance
   - Focus on persistent preferences, project details, and explicit requests
   - Format observations as complete statements with proper context
```

## AI Memory Guide

For comprehensive guidance on effective memory usage for AI models, refer to the [AI Memory Guide](AI_MEMORY_GUIDE.md). This document provides:

- Guidelines for determining what information to store
- Best practices for entity naming and observation formatting
- Examples of effective memory operations
- Decision framework for memory function usage

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
