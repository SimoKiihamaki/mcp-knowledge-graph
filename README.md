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

## Tool Categories

The enhanced memory server provides tools in several categories:

1. **Core Entity and Relation Management**: Basic tools for adding, updating and reading memory
2. **Search Functionality**: Find specific information in the knowledge graph
3. **Project Management**: Organize entities into separate projects
4. **Tag Management**: Add metadata tags to entities for better categorization
5. **Memory Health**: Tools to maintain a healthy knowledge graph
6. **Context and State Management**: Tools for working with conversation context

## Core Entity and Relation Management

### read_graph

The `read_graph` function is the most important memory tool, and works differently in our implementation:

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fullDetails` | boolean | `false` | This parameter is kept for compatibility but is ignored. The function always returns only entity names and types. |

#### Return Values

The function always returns this lightweight format to preserve context window space:

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

#### How To Use read_graph Effectively

```javascript
// Get the lightweight overview of all entities
const graph = await memory.readGraph();
// Only contains entity names and types, never the full observations
```

### create_entities

Creates multiple new entities in the knowledge graph.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entities` | Array | Array of entity objects with properties: name (required), entityType (required), observations, projectId, parentEntity, tags |

#### Example Usage

```javascript
const result = await memory.createEntities({
  entities: [
    {
      name: "person_JohnDoe",
      entityType: "Person",
      observations: ["John is a software engineer", "Prefers dark mode in all applications"],
      tags: ["employee", "developer"]
    }
  ]
});
```

### create_relations

Creates connections between entities in the knowledge graph.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `relations` | Array | Array of relation objects with properties: from (required), to (required), relationType (required), metadata |

#### Example Usage

```javascript
const result = await memory.createRelations({
  relations: [
    {
      from: "person_JohnDoe",
      to: "project_Dashboard",
      relationType: "manages",
      metadata: {
        confidence: 0.95,
        source: "conversation on 2023-09-15"
      }
    }
  ]
});
```

### add_observations

Adds new information to existing entities.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `observations` | Array | Array of objects with properties: entityName (required), contents (required) |

#### Example Usage

```javascript
const result = await memory.addObservations({
  observations: [
    {
      entityName: "person_JohnDoe",
      contents: ["Likes coffee with oat milk", "Is working on project_Dashboard"]
    }
  ]
});
```

### delete_entities

Removes entities and their associated relations from the knowledge graph.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityNames` | Array | Array of entity names to delete |

#### Example Usage

```javascript
const result = await memory.deleteEntities({
  entityNames: ["person_JohnDoe"]
});
```

## Search Functionality

### search_nodes

Searches for entities in the knowledge graph based on a query.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query to match against entity names, types, and observation content |
| `entityTypes` | Array | optional | Filter results by entity type |
| `projectId` | string | optional | Filter results by project |
| `tags` | Array | optional | Filter results by tags |
| `limit` | number | 10 | Maximum number of results to return |

#### Example Usage

```javascript
// Basic search
const results = await memory.searchNodes({ query: "dashboard" });

// Advanced search with filters
const specificResults = await memory.searchNodes({
  query: "dashboard",
  entityTypes: ["Project"],
  tags: ["active"],
  limit: 5
});
```

### open_nodes

Retrieves full details of specific entities by their names.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `names` | Array | Array of entity names to retrieve |

#### Example Usage

```javascript
const entities = await memory.openNodes({
  names: ["person_JohnDoe", "project_Dashboard"]
});
```

## Project Management

The enhanced memory server introduces project management for organizing entities into logical groups.

### create_project

Creates a new project in the knowledge graph.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Project name (will also be used as ID) |
| `description` | string | Optional project description |

#### Example Usage

```javascript
const project = await memory.createProject({
  name: "WebApp",
  description: "Customer portal web application project"
});
```

### list_projects

Lists all projects in the knowledge graph.

#### Parameters
None

#### Example Usage

```javascript
const projects = await memory.listProjects();
```

### set_current_project

Sets the current active project for context.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Project ID to set as active |

#### Example Usage

```javascript
const result = await memory.setCurrentProject({
  projectId: "WebApp"
});
```

### get_current_project

Gets the current active project.

#### Parameters
None

#### Example Usage

```javascript
const currentProject = await memory.getCurrentProject();
```

### get_recent_projects

Retrieves the most recently accessed projects.

#### Parameters
None

#### Example Usage

```javascript
const recentProjects = await memory.getRecentProjects();
```

### read_project_graph

Gets all entities for a specific project.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Project ID to read |

#### Example Usage

```javascript
const projectEntities = await memory.readProjectGraph({
  projectId: "WebApp"
});
```

## Tag Management

Tags provide a flexible way to categorize entities across projects.

### add_tags

Adds tags to an entity.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityName` | string | Name of the entity to tag |
| `tags` | Array | Array of tags to add |

#### Example Usage

```javascript
const result = await memory.addTags({
  entityName: "person_JohnDoe",
  tags: ["developer", "team-lead"]
});
```

### remove_tags

Removes tags from an entity.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityName` | string | Name of the entity |
| `tags` | Array | Array of tags to remove |

#### Example Usage

```javascript
const result = await memory.removeTags({
  entityName: "person_JohnDoe",
  tags: ["intern"]
});
```

### get_entities_by_tag

Gets all entities with a specific tag.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tag` | string | Tag to search for |
| `projectId` | string | Optional project ID to filter by |

#### Example Usage

```javascript
const entities = await memory.getEntitiesByTag({
  tag: "developer",
  projectId: "WebApp" // Optional
});
```

### get_all_tags

Gets all tags used in the system with counts.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Optional project ID to filter by |

#### Example Usage

```javascript
const tags = await memory.getAllTags({
  projectId: "WebApp" // Optional
});
```

## Memory Health Management

These tools help maintain a healthy and efficient knowledge graph.

### get_memory_health

Gets health metrics for the knowledge graph.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Optional project ID to filter by |

#### Example Usage

```javascript
const healthMetrics = await memory.getMemoryHealth({
  projectId: "WebApp" // Optional
});
```

#### Return Value Example

```json
{
  "totalEntities": 157,
  "totalRelations": 203,
  "entitiesByType": {
    "Person": 23,
    "Project": 8,
    "Component": 42
  },
  "averageObservationsPerEntity": 5.2,
  "mostRecentEntityDate": "2023-09-15T14:30:22Z",
  "possibleDuplicates": 3,
  "staleEntities": 12
}
```

### find_possible_duplicates

Finds entities that might be duplicates based on name similarity.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `entityType` | string | optional | Entity type to filter by |
| `projectId` | string | optional | Project ID to filter by |
| `similarityThreshold` | number | 0.85 | Similarity threshold (0-1) |

#### Example Usage

```javascript
const duplicates = await memory.findPossibleDuplicates({
  entityType: "Person",
  similarityThreshold: 0.9
});
```

### find_stale_entities

Finds entities that haven't been accessed in a long time.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `thresholdDays` | number | 60 | Days threshold |
| `projectId` | string | optional | Project ID to filter by |

#### Example Usage

```javascript
const staleEntities = await memory.findStaleEntities({
  thresholdDays: 30,
  projectId: "WebApp" // Optional
});
```

## Context and State Management

Tools for working with conversation context and maintaining state between sessions.

### get_recent_entities

Gets the most recently accessed entities from the knowledge graph.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 5 | Maximum number of entities to return |

#### Example Usage

```javascript
const recentEntities = await memory.getRecentEntities({
  limit: 3
});
```

### get_relevant_entities

Gets the most relevant entities based on the current conversation context.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 5 | Maximum number of entities to return |

#### Example Usage

```javascript
const relevantEntities = await memory.getRelevantEntities({
  limit: 5
});
```

### get_function_guidelines

Gets usage guidelines for knowledge graph functions.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `functionName` | string | Optional specific function to get guidelines for |

#### Example Usage

```javascript
// Guidelines for a specific function
const readGraphGuidelines = await memory.getFunctionGuidelines({
  functionName: "read_graph"
});

// All guidelines
const allGuidelines = await memory.getFunctionGuidelines();
```

### get_documentation_standards

Gets standards for documenting information in the knowledge graph.

#### Parameters
None

#### Example Usage

```javascript
const standards = await memory.getDocumentationStandards();
```

### get_working_memory

Gets the current working memory context with recently accessed entities.

#### Parameters
None

#### Example Usage

```javascript
const workingMemory = await memory.getWorkingMemory();
```

#### Return Value Example

```json
{
  "currentTopic": "project planning",
  "recentEntities": ["project_Dashboard", "person_JohnDoe"],
  "currentProject": "WebApp",
  "sessionStartTime": "2023-09-15T10:30:00Z",
  "lastAccessTime": "2023-09-15T10:45:22Z"
}
```

### set_current_topic

Sets the current conversation topic in working memory.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `topic` | string | The current topic of conversation |

#### Example Usage

```javascript
const result = await memory.setCurrentTopic({
  topic: "project planning"
});
```

### process_user_message

Processes a user message to detect when memory functions should be used.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | string | The user's message to analyze |

#### Example Usage

```javascript
const triggers = await memory.processUserMessage({
  message: "Remember that I prefer dark mode in all applications"
});
```

#### Return Value Example

```json
["store"]
```

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

5. Organize with projects and tags:
   - Create logical project groupings with create_project
   - Add relevant tags to entities for cross-project categorization
   - Filter searches by project and/or tags for more precise results

6. Maintain knowledge graph health:
   - Periodically check get_memory_health() for insights
   - Review and merge duplicates identified by find_possible_duplicates
   - Update or archive stale entities found with find_stale_entities
```

## License

MIT License
