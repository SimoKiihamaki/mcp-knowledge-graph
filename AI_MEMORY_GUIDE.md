# AI Memory Management Guide

This guide helps AI models effectively use the knowledge graph memory system. It provides examples, best practices, and guidelines for when to use specific memory functions.

## Memory Fundamentals

The knowledge graph stores information as:

1. **Entities**: Objects, people, concepts, or topics (with observations)
2. **Relations**: Connections between entities (e.g., "is part of", "created by")

### Core Memory Principles

- **Information worth remembering**: Focus on storing information that has long-term value
- **Concise representation**: Store knowledge efficiently to minimize context window usage
- **Strategic retrieval**: Only retrieve information when needed, not all at once

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

1. Start conversations by checking for relevant entities with `get_relevant_entities`
2. When user references specific topics, use `search_nodes` or `open_nodes`
3. As conversation progresses, update entities with new observations
4. Set the current topic with `set_current_topic` to improve relevance tracking

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

- **Context window efficiency**: By default, `read_graph` returns only entity names and types
- **Time-awareness**: All entities track creation and access timestamps
- **Relevance tracking**: Entities have a relevance score that increases with access
- **Function guidelines**: Use `get_function_guidelines` to understand when to use specific functions

---

By following these guidelines, AI models can effectively manage their memory to provide more contextually relevant and personalized responses while efficiently managing context window space.
