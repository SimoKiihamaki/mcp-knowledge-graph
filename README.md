# Enhanced Knowledge Graph Memory Server
# Enhanced Knowledge Graph Memory Server

An optimized implementation of persistent memory for Claude using a knowledge graph with context window management.

## Critical Configuration Note

In Claude Desktop, this server **MUST** be registered as `memory` (not "knowledge-graph" or "mcp-knowledge-graph"):
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
npm install
npm run build
```

## What's Different in This Version?

This enhanced fork addresses critical limitations in the original memory server:

1. **Context Window Protection**: The original server always returned complete entity data with all observations, rapidly filling Claude's context window. Our version always returns only names and types, with no option to get full details via `read_graph`.

2. **Function Documentation**: Original server provided no guidance on when to use memory functions. We've added built-in guidelines accessible via `get_function_guidelines`.

3. **Smart Memory Management**: Original had no tools to retrieve entities based on relevance. We've added functions to get recently accessed and contextually relevant entities.

4. **Working Memory**: Original provided no session tracking. We've added a working memory context system that maintains information about the current conversation.

5. **Temporal Awareness**: Original had no concept of when entities were created or accessed. We track creation/access timestamps and access frequency.

6. **Modular Architecture**: We've reorganized the code into a modular structure for better maintainability, with separate components for different functional areas.

7. **Project & Tag Management**: Added support for organizing entities into projects and tagging them for better organization.

## The read_graph Function Explained

The `read_graph` function is the most important memory tool, and works differently in our implementation:

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fullDetails` | boolean | `false` | This parameter is kept for compatibility but is ignored. The function always returns only entity names and types. |

### Return Values

The function always returns this lightweight format to preserve context window space:

```json
{
  "entities": [
    { "name": "person_JohnDoe", "entityType": "Person" },
    { "name": "project_Dashboard", "entityType": "Project" }
  ],
  "relations": [
    { "from": "person_JohnDoe", "to": "project_Dashboard", "relationType": "manages" }
  "entities": [
    { "name": "person_JohnDoe", "entityType": "Person" },
    { "name": "project_Dashboard", "entityType": "Project" }
  ],
  "relations": [
    { "from": "person_JohnDoe", "to": "project_Dashboard", "relationType": "manages" }
  ]
}
```

### How To Use read_graph Effectively

```javascript
// Get the lightweight overview of all entities
const graph = await memory.readGraph();
// Only contains entity names and types, never the full observations
```

### Accessing Full Entity Details

Since `read_graph` never returns full details, you must use these functions to access complete entity information:

```javascript
// To get specific entity details, use open_nodes:
const personDetails = await memory.openNodes(["person_JohnDoe"]);
// This returns full entity data including all observations

// Or search for relevant entities:
const projectData = await memory.searchNodes("dashboard");
// This also returns full entity data for matches
```

### Usage Example with Claude

```
Human: What do you know about me?

Claude: Let me check my memory.

<function_call>
read_graph()
</function_call>

I can see I have information about you stored in my memory. Would you like me to get more details about person_JohnDoe?
```

## All Available Memory Functions

| Function | Purpose | Key Parameters |
|----------|---------|----------------|
| `read_graph` | Get overview of all entities | Parameters ignored, always returns names & types |
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
   - Use read_graph() to get an overview of all entities
   - For specific entity details, use open_nodes(["entity_name"])

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

## License

MIT License