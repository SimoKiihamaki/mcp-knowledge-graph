# Enhanced Knowledge Graph Memory Server

A powerful implementation of persistent memory for Claude using a local knowledge graph with advanced memory management capabilities.

This server enables Claude to remember information across conversations, maintain context awareness, and make intelligent decisions about what information to store and retrieve.

## Key Differences From Original Implementation

Our enhanced version addresses several critical limitations of the original memory server:

### 1. Context Window Optimization
- **Original**: Always returns complete entity data with all observations, rapidly filling the context window
- **Enhanced**: Returns only entity names and types by default, preserving valuable context space while still allowing full data retrieval when explicitly requested

### 2. Memory Intelligence
- **Original**: No guidance for AI on when to use memory functions or what to document
- **Enhanced**: Built-in function usage guidelines, documentation standards, and automatic trigger detection

### 3. Temporal & Relevance Awareness
- **Original**: No tracking of when entities were created or accessed
- **Enhanced**: Full temporal tracking with creation/access timestamps, usage counters, and relevance scoring

### 4. Working Memory
- **Original**: No session context or active entity tracking
- **Enhanced**: Maintains working memory of active entities, recently discussed topics, and current conversation context

### 5. Smart Retrieval
- **Original**: No functions to retrieve relevant entities based on context
- **Enhanced**: Added `get_recent_entities` and `get_relevant_entities` for context-aware retrieval

## Quick Start Installation

```bash
# Clone the repository
git clone https://github.com/SimoKiihamaki/mcp-knowledge-graph.git

# Navigate to repository
cd mcp-knowledge-graph

# Switch to the enhanced memory branch
git checkout enhance-memory-management

# Install dependencies
npm install

# Build the project
npm run build
```

## Claude Desktop Configuration

Add this to your `claude_desktop_config.json` (typically located at `%APPDATA%\Claude Desktop\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude Desktop/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "/FULL/PATH/TO/mcp-knowledge-graph/dist/index.js",
        "--memory-path", 
        "/FULL/PATH/TO/memory.jsonl"
      ]
    }
  }
}
```

Replace `/FULL/PATH/TO/` with the actual full paths on your system. For example:
- Windows: `C:/Users/username/projects/mcp-knowledge-graph/dist/index.js`
- macOS/Linux: `/home/username/projects/mcp-knowledge-graph/dist/index.js`

## Verification

To verify installation:

1. Start Claude Desktop
2. Ask Claude: "What memory functions do you have access to? Check if you have access to functions like get_working_memory or get_relevant_entities."
3. Claude should list the enhanced memory functions including `get_relevant_entities`, `get_function_guidelines`, etc.

## Enhanced Memory Features

### Context Window Optimization
- `read_graph` now returns only entity names and types by default
- This significantly reduces context window usage
- Full entity details available on demand with the `fullDetails` parameter

### Temporal Awareness
- All entities and relations include timestamps for creation and last access
- Access counters track usage patterns over time
- Entities gain relevance scores based on access frequency

### Working Memory Context
- A separate working memory context system tracks currently active entities
- Entities are ranked by relevance based on access patterns
- Automatic tracking of recently discussed topics
- Current conversation topic tracking

### Memory Triggers
- Automatic detection of when memory functions should be used
- Identifies patterns in user messages that indicate memory operations
- Provides guidance on when to store vs. retrieve information

### Documentation Guidelines
- Built-in standards for entity naming conventions
- Guidelines for effective observation formatting
- Clear rules for what information should/shouldn't be stored

## Available Memory Tools

### Core Tools

| Function | Description | Parameters |
|----------|-------------|------------|
| `create_entities` | Create new entities | `entities`: array of entity objects |
| `create_relations` | Create connections between entities | `relations`: array of relation objects |
| `add_observations` | Add information to existing entities | `observations`: array of observation objects |
| `delete_entities` | Remove entities | `entityNames`: array of entity names |
| `delete_observations` | Remove specific observations | `deletions`: array of deletion objects |
| `delete_relations` | Remove relationships | `relations`: array of relation objects |
| `read_graph` | Read knowledge graph | `fullDetails` (optional): boolean |
| `search_nodes` | Search for entities | `query`: string |
| `open_nodes` | Retrieve specific entities | `names`: array of entity names |

### Enhanced Memory Tools

| Function | Description | Parameters |
|----------|-------------|------------|
| `get_recent_entities` | Get recently accessed entities | `limit` (optional): number |
| `get_relevant_entities` | Get contextually relevant entities | `limit` (optional): number |
| `get_function_guidelines` | Get memory function usage guidelines | `functionName` (optional): string |
| `get_documentation_standards` | Get documentation standards | none |
| `get_working_memory` | Get current working memory context | none |
| `set_current_topic` | Set the current conversation topic | `topic`: string |
| `process_user_message` | Detect memory triggers in message | `message`: string |

## Example Usage Patterns

### Entity Creation

```javascript
// Create a new person entity
await knowledgeGraphManager.createEntities([{
  name: "person_JohnDoe",
  entityType: "Person",
  observations: [
    "Full name is John Doe",
    "Works as a software engineer", 
    "Has been a customer since 2025-01-15"
  ]
}]);
```

### Topic-Based Memory Retrieval

```javascript
// When the user asks about a topic:
const triggers = await knowledgeGraphManager.processUserMessage(
  "What do you remember about my project?"
);

if (triggers.includes('retrieve')) {
  // Search for relevant entities
  const projectInfo = await knowledgeGraphManager.searchNodes("project");
  
  // Update current topic
  await knowledgeGraphManager.setCurrentTopic("user's projects");
}
```

### Memory Consolidation

```javascript
// At the start of a conversation
const workingMemory = await knowledgeGraphManager.getWorkingMemory();
const relevantEntities = await knowledgeGraphManager.getRelevantEntities(5);

// Use this information to personalize the conversation
```

## Technical Implementation Details

### read_graph Implementation

The optimized `read_graph` function is central to our enhancements:

```typescript
async readGraph(fullDetails: boolean = false): Promise<KnowledgeGraph | SummaryKnowledgeGraph> {
  const graph = await this.loadGraph();
  
  if (fullDetails) {
    // Update access timestamps for all entities
    const now = new Date().toISOString();
    graph.entities.forEach(entity => {
      entity.lastAccessed = now;
      entity.accessCount = (entity.accessCount || 0) + 1;
    });
    await this.saveGraph(graph);
    
    return graph;
  }
  
  // Return a lightweight version with only entity names and types
  return {
    entities: graph.entities.map(entity => ({
      name: entity.name,
      entityType: entity.entityType
    })),
    relations: graph.relations
  };
}
```

### Working Memory Structure

Our working memory system maintains session context:

```typescript
interface WorkingMemoryContext {
  activeEntities: string[]; // Currently active entities in conversation
  recentlyDiscussed: {
    entity: string,
    timestamp: string, // ISO timestamp
    relevanceScore: number
  }[];
  currentTopic: string;
  pendingInformation: any[];
  lastUpdated: string; // ISO timestamp
}
```

## System Prompt Example

For optimal usage, add this to your Claude system prompt:

```
Follow these steps for optimal memory management:

1. Start conversations by checking for context:
   - Use get_working_memory and get_relevant_entities
   - Process the user's messages with process_user_message to detect memory operations

2. Use smart retrieval:
   - Use search_nodes for specific topics
   - For known entities, use open_nodes for details
   - Remember read_graph only returns names/types by default

3. Follow documentation best practices:
   - Use get_documentation_standards for consistent formatting
   - Track conversation topics with set_current_topic
   - Structure entities with proper naming (e.g., person_Name, project_Title)

4. Prioritize important information:
   - Store persistent preferences, project details, and explicit requests
   - Format observations as complete statements with context
   - Include relevant dates and attribution in observations
```

## Storage and Performance

- The knowledge graph is stored in a JSONL file for simplicity and portability
- Working memory is stored in a separate JSON file to maintain session context
- The server is optimized for typical personal usage (hundreds to thousands of entities)
- All operations are asynchronous and support promise-based workflows

## Troubleshooting

### Common Issues

1. **Module not found error**:
   - Ensure you've checked out the `enhance-memory-management` branch
   - Verify paths in configuration are absolute and correct
   - Run `npm run build` to generate the dist folder

2. **Claude doesn't use the enhanced functions**:
   - Verify Claude Desktop is configured to use "memory" as the server name
   - Check Claude Desktop logs for connection errors
   - Restart Claude Desktop after configuration changes

3. **Working memory not persisting**:
   - Check file permissions for the memory.jsonl file
   - Verify the path in your configuration exists and is writable

## Documentation

For comprehensive guidance on effective memory usage, refer to [AI_MEMORY_GUIDE.md](AI_MEMORY_GUIDE.md).

For detailed setup instructions, see [SETUP.md](SETUP.md).

## License

This MCP server is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
