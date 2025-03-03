# AI Memory Management Guide

This guide helps AI models effectively use the knowledge graph memory system. It provides examples, best practices, and guidelines for when to use specific memory functions.

## Memory Fundamentals

The knowledge graph stores information as:

1. **Entities**: Objects, people, concepts, or topics (with observations)
2. **Relations**: Connections between entities (e.g., "is part of", "created by")
3. **Projects**: Organizational units that group related entities and relations
4. **Tags**: Flexible categorization system for entities

### Core Memory Principles

- **Information worth remembering**: Focus on storing information that has long-term value
- **Concise representation**: Store knowledge efficiently to minimize context window usage
- **Strategic retrieval**: Only retrieve information when needed, not all at once
- **Project organization**: Group related information into projects for efficient retrieval
- **Tagging and categorization**: Use tags to create flexible groupings across entities

## Project Management

The knowledge graph now supports organizing information into projects. This helps ensure that memory retrieval is focused on the current project context.

### Creating and Managing Projects

```javascript
// Create a new project
await knowledgeGraphManager.createProject("WebDevelopment", "Project for web development related memories");

// Set the current active project
await knowledgeGraphManager.setCurrentProject("WebDevelopment");

// List all available projects
const projects = await knowledgeGraphManager.listProjects();

// Get entities specific to a project
const projectGraph = await knowledgeGraphManager.readProjectGraph("WebDevelopment");
```

### Working with Project-Specific Memory

When a current project is set, all new entities created will automatically be associated with that project unless explicitly specified otherwise. Search operations will also default to the current project context.

```javascript
// Create an entity in the current project
await knowledgeGraphManager.createEntities([{
  name: "ReactHooks",
  entityType: "Concept",
  observations: ["React hooks were introduced in React 16.8"]
}]);

// Search within the current project (automatic)
const searchResults = await knowledgeGraphManager.searchNodes("hooks");

// Search across all projects (explicit)
const allResults = await knowledgeGraphManager.advancedSearch({ 
  query: "hooks",
  projectId: null // Set to null to search across all projects
});
```

## Entity Tagging

The knowledge graph now supports tagging entities for more flexible organization beyond just entity types and projects.

### Working with Tags

```javascript
// Add tags to an entity
await knowledgeGraphManager.addTags("ReactHooks", ["frontend", "javascript", "important"]);

// Remove tags from an entity
await knowledgeGraphManager.removeTags("ReactHooks", ["important"]);

// Find entities with a specific tag
const frontendEntities = await knowledgeGraphManager.getEntityByTag("frontend");

// Find tagged entities within a specific project
const projectFrontendEntities = await knowledgeGraphManager.getEntityByTag("frontend", "WebDevelopment");

// Search with tag filters
const results = await knowledgeGraphManager.advancedSearch({
  tags: ["frontend", "javascript"],
  entityTypes: ["Component"]
});
```

### Tag Best Practices

1. **Consistent tagging**: Use a consistent set of tags across entities
2. **Hierarchical tags**: Consider using prefixes for tag hierarchies (e.g., "status:active", "priority:high")
3. **Tag namespacing**: Use categories for tags (e.g., "tech:react", "tech:typescript")
4. **Complementary to types**: Use tags for cross-cutting concerns that don't fit neatly into entity types

## Memory Health Management

The knowledge graph now includes tools to maintain healthy and useful memory over time.

### Memory Health Metrics

```javascript
// Get memory health metrics for the entire graph
const healthMetrics = await knowledgeGraphManager.getMemoryHealthMetrics();

// Get memory health metrics for a specific project
const projectHealth = await knowledgeGraphManager.getMemoryHealthMetrics("WebDevelopment");
```

This provides information about:
- Total number of entities and relations
- Entity counts by project and type
- Stale entities (not accessed in 30+ days)
- Untagged entities
- Orphaned entities (no relations)
- Possible duplicate entities

### Deprecation Instead of Deletion

Instead of deleting outdated entities, you can mark them as deprecated:

```javascript
// Deprecate an entity
await knowledgeGraphManager.deprecateEntity(
  "OldComponent", 
  "Replaced by NewComponent with improved API"
);
```

Deprecated entities:
- Retain their historical information
- Are tagged with "deprecated" for easy filtering
- Include a timestamped observation with the deprecation reason

### Memory Maintenance Best Practices

1. **Regular health checks**: Periodically review memory health metrics
2. **Tag untagged entities**: Add appropriate tags to categorize entities
3. **Connect orphaned entities**: Create relations for isolated entities
4. **Review stale entities**: Update or deprecate entities that haven't been accessed in a long time
5. **Address duplicates**: Merge or differentiate similar entities

## When to Use Memory Functions

### Determining When to Access Memory

The `process_user_message` function can automatically detect memory triggers in user messages:

- References to past information ("you mentioned earlier", "remember when I told you")
- Requests to remember something ("remember this", "don't forget")
- Corrections to existing information ("that's not right", "actually it's")

Example:
```json
{
  "message": "Remember when I told you about my project deadline?",
  "triggers": ["retrieve"]
}
```

### Recommended Memory Workflow

1. Start conversations by checking the memory landscape:
   - Use `read_graph()` to get an overview of entity names and types
   - Check for relevant entities with `get_relevant_entities(5)`
   - Get working memory context with `get_working_memory()`

2. For detailed information retrieval:
   - When you know the entity name, use `open_nodes(["entity_name"])`
   - When searching by keyword, use `search_nodes("keyword")`
   - For recent entities, use `get_recent_entities()`

3. As conversation progresses:
   - Update entities with new observations using `add_observations`
   - Set the current topic with `set_current_topic` to improve relevance tracking

## Important Note About read_graph

The `read_graph` function **always** returns only entity names and types, never the observations. This is by design to preserve context window space. To get complete entity information with observations, you must use either:

- `open_nodes(["entity_name"])` for specific known entities
- `search_nodes("keyword")` to find and get details about relevant entities

```javascript
// This ONLY gives you entity names and types:
const overview = await knowledgeGraphManager.readGraph();

// To get full entity details including observations:
const entityDetails = await knowledgeGraphManager.openNodes(["person_JohnDoe"]);
```

## Documentation Best Practices

### Entity Naming Conventions

```javascript
// GOOD - Specific and categorized
{
  "name": "project_SalesAnalytics",
  "entityType": "Project",
  "observations": ["A data analysis project started in Q1 2025"]
}

// AVOID - Too generic and uncategorized
{
  "name": "Sales",
  "entityType": "Topic",
  "observations": ["Something about sales"]
}
```

### Effective Observations

Good observations are:
- Complete statements with context
- Specific and unambiguous
- Include relevant dates or timeframes
- Properly attributed when appropriate

```javascript
// GOOD - Clear, specific, and includes context
[
  "User prefers to be addressed as 'Dr. Smith' in formal communications",
  "User mentioned on 2025-03-01 they have a deadline on April 15th for the annual report",
  "User expressed strong interest in machine learning techniques for data analysis"
]

// AVOID - Vague, ambiguous, lacks context
[
  "Likes being called doctor",
  "Has a deadline",
  "Interested in ML"
]
```

### Relationship Documentation

Relationships should:
- Be in active voice
- Clearly define the direction of relationship
- Use consistent relationship types

```javascript
// GOOD
{
  "from": "person_JohnSmith",
  "to": "project_SalesAnalytics",
  "relationType": "manages"
}

// GOOD
{
  "from": "project_SalesAnalytics",
  "to": "concept_MachineLearning",
  "relationType": "uses"
}
```

## Memory Function Usage Examples

### Creating New Entities

```javascript
// When user introduces a new project
await knowledgeGraphManager.createEntities([{
  name: "project_QuarterlyReport",
  entityType: "Document",
  observations: [
    "A quarterly financial report due on 2025-04-15",
    "Contains analysis of Q1 2025 performance metrics",
    "User mentioned on 2025-03-01 they are responsible for completing it"
  ]
}]);
```

### Adding Observations to Existing Entities

```javascript
// When learning new information about an existing entity
await knowledgeGraphManager.addObservations([{
  entityName: "project_QuarterlyReport",
  contents: [
    "User mentioned on 2025-03-02 they need help with the executive summary section"
  ]
}]);
```

### Creating Relationships

```javascript
// Connecting related entities
await knowledgeGraphManager.createRelations([{
  from: "person_JaneSmith",
  to: "project_QuarterlyReport",
  relationType: "reviewsContentOf"
}]);
```

### Reading Specific Entities

```javascript
// When user asks about a specific project
const projectData = await knowledgeGraphManager.openNodes(["project_QuarterlyReport"]);
```

### Smart Entity Retrieval

```javascript
// At the start of a conversation, get relevant context
const relevantEntities = await knowledgeGraphManager.getRelevantEntities(3);
```

## Effective Memory Conversation Flow

Here is a typical conversation flow that demonstrates effective memory usage:

```
Human: Can you remind me about my project deadlines?

AI: Let me check my memory.
(Calls read_graph() to get an overview of entities)
(Notices person_User and project_QuarterlyReport entities)
(Calls openNodes(["project_QuarterlyReport"]) to get details)

I can see you have a quarterly report due on April 15th, 2025. Would you like more details about this project?
```

## Prioritizing Information

Not all information needs to be stored. Focus on:

1. **Persistent preferences**: User preferences that apply across sessions
2. **Project details**: Specifications, requirements, deadlines
3. **Important facts**: Contextual information needed in future conversations
4. **Explicit requests**: Information the user explicitly asks you to remember

## Technical Implementation Notes

The system maintains two types of memory:

1. **Persistent knowledge graph**: Long-term storage in memory.jsonl
2. **Working memory context**: Short-term session context in working_memory.json

The working memory helps track:
- Which entities are currently active in conversation
- Recently discussed entities ranked by relevance
- Current conversation topic
- Pending information that may need to be stored

## Special Considerations

- **Context window efficiency**: `read_graph` always returns only entity names and types
- **Time-awareness**: All entities track creation and access timestamps
- **Relevance tracking**: Entities have a relevance score that increases with access
- **Function guidelines**: Use `get_function_guidelines` to understand when to use specific functions

## Advanced Search Capabilities

The knowledge graph now supports enhanced search capabilities for more precise memory retrieval:

### Advanced Filtering

```javascript
// Search with multiple filters
const results = await knowledgeGraphManager.advancedSearch({
  query: "database",               // Text to search for
  entityTypes: ["Concept", "Bug"], // Filter by entity types
  projectId: "WebDevelopment",     // Filter by project
  createdAfter: "2025-01-01T00:00:00Z", // Filter by creation date
  minRelevance: 0.5,               // Only return entities with sufficient relevance
  limit: 10                        // Limit number of results
});
```

### Common Search Patterns

1. **Project-Specific Search**
   ```javascript
   // Search only within current project (default behavior)
   const results = await knowledgeGraphManager.searchNodes("database");
   
   // Explicitly search in specific project
   const projectResults = await knowledgeGraphManager.advancedSearch({
     query: "database",
     projectId: "DataScience"
   });
   ```

2. **Entity Type Filtering**
   ```javascript
   // Find all bugs in the current project
   const bugs = await knowledgeGraphManager.advancedSearch({
     entityTypes: ["Bug"]
   });
   
   // Find recent architectural decisions
   const architecture = await knowledgeGraphManager.advancedSearch({
     entityTypes: ["Architecture"],
     createdAfter: "2025-02-01T00:00:00Z"
   });
   ```

3. **Relevance-Based Retrieval**
   ```javascript
   // Find most relevant entities about a topic
   const relevant = await knowledgeGraphManager.advancedSearch({
     query: "performance",
     minRelevance: 0.8,
     limit: 5
   });
   ```

---

By following these guidelines, AI models can effectively manage their memory to provide more contextually relevant and personalized responses while efficiently managing context window space.
