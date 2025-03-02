# Enhanced Knowledge Graph Memory Server

An optimized implementation of persistent memory for Claude using a knowledge graph with context window management.

## Critical Configuration Note

In Claude Desktop, this server **MUST** be registered as `memory` (not "knowledge-graph" or "mcp-knowledge-graph"):

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

## Quick Installation

```bash
git clone https://github.com/SimoKiihamaki/mcp-knowledge-graph.git
cd mcp-knowledge-graph
git checkout enhance-memory-management
npm install
npm run build
```

## What's Different in This Version?

This enhanced fork addresses critical limitations in the original memory server:

1. **Context Window Optimization**: The original server always returned complete entity data with all observations, rapidly filling Claude's context window. Our version only returns names and types by default.

2. **Function Documentation**: Original server provided no guidance on when to use memory functions. We've added built-in guidelines accessible via `get_function_guidelines`.

3. **Smart Memory Management**: Original had no tools to retrieve entities based on relevance. We've added functions to get recently accessed and contextually relevant entities.

4. **Working Memory**: Original provided no session tracking. We've added a working memory context system that maintains information about the current conversation.

5. **Temporal Awareness**: Original had no concept of when entities were created or accessed. We track creation/access timestamps and access frequency.

## The read_graph Function Explained

The `read_graph` function is the most important memory tool, and works differently in our implementation:

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fullDetails` | boolean | `false` | When `false`, returns only entity names and types. When `true`, returns complete entities with all observations. |

### Return Values

When `fullDetails` is `false` (default):
```json
{
  "entities": [
    { "name": "person_JohnDoe", "entityType": "Person" },
    { "name": "project_Dashboard", "entityType": "Project" }
  ],
  "relations": [
    { "from": "person_JohnDoe", "to": "project_Dashboard", "relationType": "manages" }
  ]
}
```

When `fullDetails` is `true`:
```json
{
  "entities": [
    {
      "name": "person_JohnDoe", 
      "entityType": "Person",
      "observations": [
        "Full name is John Doe",
        "Works as a software engineer"
      ],
      "createdAt": "2025-03-01T12:34:56Z",
      "lastAccessed": "2025-03-02T09:45:22Z",
      "accessCount": 5
    },
    {
      "name": "project_Dashboard", 
      "entityType": "Project",
      "observations": [
        "A data visualization project started on 2025-01-15"
      ],
      "createdAt": "2025-03-01T13:45:12Z",
      "lastAccessed": "2025-03-02T09:45:22Z",
      "accessCount": 3
    }
  ],
  "relations": [
    {
      "from": "person_JohnDoe", 
      "to": "project_Dashboard", 
      "relationType": "manages",
      "createdAt": "2025-03-01T13:50:22Z",
      "lastAccessed": "2025-03-02T09:45:22Z"
    }
  ]
}
```

### How To Use read_graph Effectively

```javascript
// Get a lightweight overview (RECOMMENDED FOR MOST CASES)
const graph = await knowledgeGraphManager.readGraph();
// Only contains entity names and types, preserving context window

// Get complete details when necessary
const fullGraph = await knowledgeGraphManager.readGraph(true);
// Contains all entity data including observations
```

### Usage Example with Claude

```
Human: What do you know about me?

Claude: Let me check my memory.

<function_call>
read_graph()
</function_call>

I can see I have information about you stored in my memory. Would you like me to share what I know about person_JohnDoe?
```

## All Available Memory Functions

| Function | Purpose | Key Parameters |
|----------|---------|----------------|
| `read_graph` | Get overview of all entities | `fullDetails`: boolean (default: false) |
| `open_nodes` | Get specific entities by name | `names`: string[] |
| `search_nodes` | Find entities by keyword | `query`: string |
| `create_entities` | Create new entities | `entities`: Entity[] |
| `create_relations` | Create connections | `relations`: Relation[] |
| `add_observations` | Add info to entities | `observations`: {entityName, contents}[] |
| `get_recent_entities` | Get recently accessed | `limit`: number (default: 5) |
| `get_relevant_entities` | Get contextually relevant | `limit`: number (default: 5) |
| `get_function_guidelines` | Get usage guidance | `functionName`: string (optional) |
| `get_documentation_standards` | Get doc standards | none |
| `get_working_memory` | Get session context | none |
| `set_current_topic` | Set conversation topic | `topic`: string |
| `process_user_message` | Detect memory triggers | `message`: string |

## Recommended Claude System Prompt

Use this system prompt to take full advantage of the enhanced memory features:

```
When using memory, follow these best practices:

1. Start conversations by checking context:
   - First use get_working_memory and get_relevant_entities(5)
   - Use read_graph() WITHOUT fullDetails parameter to preserve context window
   - For specific entities, use open_nodes(["entity_name"])

2. For memory retrieval:
   - Process user messages with process_user_message to detect retrieval needs
   - Use search_nodes for keyword searches
   - Use get_recent_entities when recency matters

3. When storing information:
   - Follow documentation standards from get_documentation_standards()
   - Use entity prefixes (person_, project_, etc.)
   - Include full context in observations
   - Track the current topic with set_current_topic

4. Always check function guidelines if unsure:
   - Use get_function_guidelines("function_name") for specific guidance
```

## Detailed Setup Instructions

For complete installation and configuration details, see [SETUP.md](SETUP.md).

For guidance on effective memory usage patterns, see [AI_MEMORY_GUIDE.md](AI_MEMORY_GUIDE.md).

## License

MIT License - See [LICENSE](LICENSE) file for details.
