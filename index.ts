#!/usr/bin/env node

// Use require format to avoid ES module issues
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import { isAbsolute } from 'path';
import { KnowledgeGraphManager } from './src/core/KnowledgeGraphManager.js';
import { ProjectManager } from './src/managers/ProjectManager.js';
import { TagManager } from './src/managers/TagManager.js';
import { SearchManager } from './src/managers/SearchManager.js';
import { MemoryHealthManager } from './src/managers/MemoryHealthManager.js';
import { Entity, Relation, SearchFilter } from './src/types/interfaces.js';

// Parse args and handle paths safely
const argv = minimist(process.argv.slice(2));
let memoryPath = argv['memory-path'];

// If a custom path is provided, ensure it's absolute
if (memoryPath && !isAbsolute(memoryPath)) {
    memoryPath = path.resolve(process.cwd(), memoryPath);
}

// Define the path to the JSONL file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use the custom path or default to the installation directory
const MEMORY_FILE_PATH = memoryPath || path.join(__dirname, 'memory.jsonl');
// Define path for working memory context
const WORKING_MEMORY_PATH = path.join(path.dirname(MEMORY_FILE_PATH), 'working_memory.json');

// Initialize managers
const knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH, WORKING_MEMORY_PATH);
const projectManager = new ProjectManager(knowledgeGraphManager);
const tagManager = new TagManager(knowledgeGraphManager);
const searchManager = new SearchManager(knowledgeGraphManager);
const memoryHealthManager = new MemoryHealthManager(knowledgeGraphManager);

// Create the MCP server
const server = new Server(
  {
    name: "mcp-knowledge-graph",
    version: "1.0.1",
  },    
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Core entity and relation management
      {
        name: "create_entities",
        description: "Create multiple new entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The name of the entity" },
                  entityType: { type: "string", description: "The type of the entity" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observation contents associated with the entity"
                  },
                  projectId: { type: "string", description: "Optional project ID this entity belongs to" },
                  parentEntity: { type: "string", description: "Optional parent entity for hierarchical structure" },
                  tags: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Optional array of tags for categorization"
                  }
                },
                required: ["name", "entityType"],
              },
            },
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                  metadata: {
                    type: "object",
                    properties: {
                      confidence: { type: "number", description: "Confidence level of this relation (0-1)" },
                      source: { type: "string", description: "Source of this relation" },
                      notes: { type: "string", description: "Additional notes about this relation" }
                    }
                  }
                },
                required: ["from", "to", "relationType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "add_observations",
        description: "Add new observations to existing entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add the observations to" },
                  contents: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observation contents to add"
                  },
                },
                required: ["entityName", "contents"],
              },
            },
          },
          required: ["observations"],
        },
      },
      {
        name: "delete_entities",
        description: "Delete multiple entities and their associated relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to delete"
            },
          },
          required: ["entityNames"],
        },
      },
      {
        name: "read_graph",
        description: "Read the knowledge graph, always returns only entity names and types to save context window space",
        inputSchema: {
          type: "object",
          properties: {
            fullDetails: { 
              type: "boolean", 
              description: "Parameter is ignored, function always returns lightweight version to preserve context window" 
            },
          },
        },
      },
      
      // Search functionality
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
            entityTypes: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of entity types to filter by"
            },
            projectId: { type: "string", description: "Optional project ID to filter by" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of tags to filter by"
            },
            limit: { type: "number", description: "Maximum number of results to return (default: 10)" }
          },
          required: ["query"],
        },
      },
      {
        name: "open_nodes",
        description: "Open specific nodes in the knowledge graph by their names",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to retrieve",
            },
          },
          required: ["names"],
        },
      },
      
      // Project management
      {
        name: "create_project",
        description: "Create a new project in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name (will also be used as ID)" },
            description: { type: "string", description: "Optional project description" }
          },
          required: ["name"],
        },
      },
      {
        name: "list_projects",
        description: "List all projects in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_current_project",
        description: "Set the current active project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID to set as active" }
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_current_project",
        description: "Get the current active project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_recent_projects",
        description: "Get the most recently accessed projects",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "read_project_graph",
        description: "Get all entities for a specific project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID to read" }
          },
          required: ["projectId"],
        },
      },
      
      // Tag management
      {
        name: "add_tags",
        description: "Add tags to an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "Name of the entity to tag" },
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "Array of tags to add"
            }
          },
          required: ["entityName", "tags"],
        },
      },
      {
        name: "remove_tags",
        description: "Remove tags from an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "Name of the entity" },
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "Array of tags to remove"
            }
          },
          required: ["entityName", "tags"],
        },
      },
      {
        name: "get_entities_by_tag",
        description: "Get all entities with a specific tag",
        inputSchema: {
          type: "object",
          properties: {
            tag: { type: "string", description: "Tag to search for" },
            projectId: { type: "string", description: "Optional project ID to filter by" }
          },
          required: ["tag"],
        },
      },
      {
        name: "get_all_tags",
        description: "Get all tags used in the system with counts",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Optional project ID to filter by" }
          },
        },
      },
      
      // Memory health
      {
        name: "get_memory_health",
        description: "Get health metrics for the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Optional project ID to filter by" }
          },
        },
      },
      {
        name: "find_possible_duplicates",
        description: "Find entities that might be duplicates based on name similarity",
        inputSchema: {
          type: "object",
          properties: {
            entityType: { type: "string", description: "Optional entity type to filter by" },
            projectId: { type: "string", description: "Optional project ID to filter by" },
            similarityThreshold: { type: "number", description: "Similarity threshold (0-1, default: 0.85)" }
          },
        },
      },
      {
        name: "find_stale_entities",
        description: "Find entities that haven't been accessed in a long time",
        inputSchema: {
          type: "object",
          properties: {
            thresholdDays: { type: "number", description: "Days threshold (default: 60)" },
            projectId: { type: "string", description: "Optional project ID to filter by" }
          },
        },
      },
      
      // Context and state management
      {
        name: "get_recent_entities",
        description: "Get the most recently accessed entities from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of entities to return (default: 5)" }
          },
        },
      },
      {
        name: "get_relevant_entities",
        description: "Get the most relevant entities based on the current conversation context",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of entities to return (default: 5)" }
          },
        },
      },
      {
        name: "get_function_guidelines",
        description: "Get usage guidelines for knowledge graph functions to understand when and how to use them",
        inputSchema: {
          type: "object",
          properties: {
            functionName: { type: "string", description: "Specific function to get guidelines for (optional, returns all if not specified)" }
          },
        },
      },
      {
        name: "get_documentation_standards",
        description: "Get standards for documenting information in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_working_memory",
        description: "Get the current working memory context with recently accessed entities",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_current_topic",
        description: "Set the current conversation topic in working memory",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "The current topic of conversation" }
          },
          required: ["topic"],
        },
      },
      {
        name: "process_user_message",
        description: "Process a user message to detect when memory functions should be used",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string", description: "The user's message to analyze" }
          },
          required: ["message"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args && 
      name !== "get_documentation_standards" && 
      name !== "get_working_memory" &&
      name !== "list_projects" &&
      name !== "get_current_project" &&
      name !== "get_recent_projects" &&
      name !== "get_all_tags" &&
      name !== "get_memory_health") {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  try {
    switch (name) {
      // Core entity and relation management
      case "create_entities":
        const entities: Entity[] = [];
        if (args && Array.isArray(args.entities)) {
          for (const entity of args.entities) {
            const result = await knowledgeGraphManager.createEntity(
              entity.name,
              entity.entityType,
              entity.observations || [],
              entity.projectId,
              entity.parentEntity,
              entity.tags
            );
            if (result) {
              entities.push(result);
            }
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(entities, null, 2) }] };

      case "create_relations":
        const relations: Relation[] = [];
        if (args && Array.isArray(args.relations)) {
          for (const relation of args.relations) {
            const result = await knowledgeGraphManager.createRelation(
              relation.from,
              relation.to,
              relation.relationType,
              relation.metadata
            );
            if (result) {
              relations.push(result);
            }
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(relations, null, 2) }] };

      case "add_observations":
        const results: { entityName: any; addedObservations: any }[] = [];
        if (args && Array.isArray(args.observations)) {
          for (const observation of args.observations) {
            const entity = await knowledgeGraphManager.getEntity(observation.entityName);
            if (entity) {
              const updatedEntity = await knowledgeGraphManager.updateEntity(
                observation.entityName,
                { observations: [...entity.observations, ...observation.contents] }
              );
              if (updatedEntity) {
                results.push({
                  entityName: observation.entityName,
                  addedObservations: observation.contents
                });
              }
            }
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };

      case "delete_entities":
        if (args && Array.isArray(args.entityNames)) {
          for (const entityName of args.entityNames) {
            await knowledgeGraphManager.deleteEntity(entityName);
          }
        }
        return { content: [{ type: "text", text: "Entities deleted successfully" }] };

      case "read_graph":
        const graph = await knowledgeGraphManager.readGraph();
        return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };

      // Search functionality
      case "search_nodes":
        if (!args) return { content: [{ type: "text", text: "No search parameters provided" }] };
        
        const searchFilter: SearchFilter = {
          query: typeof args.query === 'string' ? args.query : "",
          entityTypes: args.entityTypes as string[] | undefined,
          projectId: args.projectId as string | undefined,
          tags: args.tags as string[] | undefined,
          limit: typeof args.limit === 'number' ? args.limit : 10
        };
        
        const searchResults = await searchManager.search(searchFilter);
        return { content: [{ type: "text", text: JSON.stringify(searchResults, null, 2) }] };

      case "open_nodes":
        if (!args || !Array.isArray(args.names)) return { content: [{ type: "text", text: "No node names provided" }] };
        
        const nodes = await Promise.all(
          args.names.map((name: string) => knowledgeGraphManager.getEntity(name))
        );
        return { content: [{ type: "text", text: JSON.stringify({ nodes: nodes.filter((node: Entity | null) => node !== null) }, null, 2) }] };

      // Project management
      case "create_project":
        if (!args || typeof args.name !== 'string') {
          return { content: [{ type: "text", text: "Project name is required" }] };
        }
        const project = await projectManager.createProject(
          args.name,
          args.description
        );
        return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
        
      case "list_projects":
        const projects = await projectManager.listProjects();
        return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
        
      case "set_current_project":
        if (!args || typeof args.projectId !== 'string') {
          return { content: [{ type: "text", text: "Project ID is required" }] };
        }
        const success = await projectManager.setCurrentProject(args.projectId);
        if (success) {
          return { content: [{ type: "text", text: `Current project set to: ${args.projectId}` }] };
        } else {
          return { content: [{ type: "text", text: `Project ${args.projectId} not found` }] };
        }
        
      case "get_current_project":
        const currentProject = await projectManager.getCurrentProject();
        if (currentProject) {
          return { content: [{ type: "text", text: JSON.stringify(currentProject, null, 2) }] };
        } else {
          return { content: [{ type: "text", text: "No current project set" }] };
        }
        
      case "get_recent_projects":
        const recentProjects = await projectManager.getRecentProjects();
        return { content: [{ type: "text", text: JSON.stringify(recentProjects, null, 2) }] };
        
      case "read_project_graph":
        if (!args || typeof args.projectId !== 'string') {
          return { content: [{ type: "text", text: "Project ID is required" }] };
        }
        const projectEntities = await projectManager.readProjectGraph(args.projectId);
        return { content: [{ type: "text", text: JSON.stringify(projectEntities, null, 2) }] };
        
      // Tag management
      case "add_tags":
        if (!args || typeof args.entityName !== 'string' || !Array.isArray(args.tags)) {
          return { content: [{ type: "text", text: "Entity name and tags array are required" }] };
        }
        const taggedEntity = await tagManager.addTags(args.entityName, args.tags);
        if (taggedEntity) {
          return { content: [{ type: "text", text: JSON.stringify(taggedEntity, null, 2) }] };
        } else {
          return { content: [{ type: "text", text: `Entity ${args.entityName} not found` }] };
        }
        
      case "remove_tags":
        if (!args || typeof args.entityName !== 'string' || !Array.isArray(args.tags)) {
          return { content: [{ type: "text", text: "Entity name and tags array are required" }] };
        }
        const untaggedEntity = await tagManager.removeTags(args.entityName, args.tags);
        if (untaggedEntity) {
          return { content: [{ type: "text", text: JSON.stringify(untaggedEntity, null, 2) }] };
        } else {
          return { content: [{ type: "text", text: `Entity ${args.entityName} not found` }] };
        }
        
      case "get_entities_by_tag":
        if (!args || typeof args.tag !== 'string') {
          return { content: [{ type: "text", text: "Tag is required" }] };
        }
        const taggedEntities = await tagManager.getEntitiesByTag(
          args.tag,
          typeof args.projectId === 'string' ? args.projectId : undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(taggedEntities, null, 2) }] };
        
      case "get_all_tags":
        const tags = await tagManager.getAllTags(
          typeof args?.projectId === 'string' ? args.projectId : undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
        
      // Memory health
      case "get_memory_health":
        const healthMetrics = await memoryHealthManager.getMemoryHealth(
          typeof args?.projectId === 'string' ? args.projectId : undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(healthMetrics, null, 2) }] };
        
      case "find_possible_duplicates":
        const duplicates = await memoryHealthManager.findPossibleDuplicates(
          typeof args?.entityType === 'string' ? args.entityType : undefined,
          typeof args?.projectId === 'string' ? args.projectId : undefined,
          typeof args?.similarityThreshold === 'number' ? args.similarityThreshold : undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(duplicates, null, 2) }] };
        
      case "find_stale_entities":
        const staleEntities = await memoryHealthManager.findStaleEntities(
          typeof args?.thresholdDays === 'number' ? args.thresholdDays : undefined,
          typeof args?.projectId === 'string' ? args.projectId : undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(staleEntities, null, 2) }] };
        
      // Context and state management
      case "get_recent_entities":
        // First get all entity names, then retrieve their details
        const summaryGraph = await knowledgeGraphManager.readGraph();
        const entityNames = summaryGraph.entities.map((e: any) => e.name);
        
        // Get full entity details
        const fullEntities: Entity[] = [];
        for (const name of entityNames) {
          const entity = await knowledgeGraphManager.getEntity(name);
          if (entity && entity.lastAccessed) {
            fullEntities.push(entity);
          }
        }
        
        // Sort by lastAccessed date and limit
        const recentEntities = fullEntities
          .sort((a, b) => {
            const aDate = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
            const bDate = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
            return bDate - aDate;
          })
          .slice(0, args && typeof args.limit === 'number' ? args.limit : 5);
        
        return { content: [{ type: "text", text: JSON.stringify({ entities: recentEntities }, null, 2) }] };

      case "get_relevant_entities":
        const topic = knowledgeGraphManager.getWorkingMemory().currentTopic || "";
        const relevantFilter: SearchFilter = {
          query: topic,
          limit: typeof args?.limit === 'number' ? args.limit : 5
        };
        return { content: [{ type: "text", text: JSON.stringify(await searchManager.search(relevantFilter), null, 2) }] };

      case "get_function_guidelines":
        // This functionality isn't directly implemented in our modular version,
        // so we'll provide a simplified implementation
        const guidelines: Record<string, any> = {
          read_graph: {
            whenToUse: [
              "At the beginning of a conversation to check existing knowledge",
              "When the user refers to something you might have stored previously"
            ],
            whenNotToUse: [
              "After every user message (would waste context space)"
            ],
            bestPractices: [
              "Use open_nodes for specific entities to get full details when needed"
            ]
          },
          // Add other function guidelines as needed
        };
        
        if (args && typeof args.functionName === 'string' && guidelines[args.functionName]) {
          return { content: [{ type: "text", text: JSON.stringify(guidelines[args.functionName], null, 2) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(guidelines, null, 2) }] };

      case "get_documentation_standards":
        // Simplified version from the main branch
        const standards = {
          entityNaming: [
            "Use specific, unique identifiers (e.g., 'John_Smith' not just 'John')",
            "Be consistent with naming conventions (camelCase for most entities)",
            "Include a category prefix for common entity types (person_John, project_Dashboard)"
          ],
          whatToDocument: [
            "User preferences and important personal details",
            "Project-specific information with long-term value",
            "Information the user explicitly asks to remember"
          ],
          observationFormatting: [
            "Write in complete, clear statements",
            "Include contextual information (when/where this was learned)",
            "Format dates consistently (YYYY-MM-DD)"
          ]
        };
        return { content: [{ type: "text", text: JSON.stringify(standards, null, 2) }] };

      case "get_working_memory":
        return { content: [{ type: "text", text: JSON.stringify(knowledgeGraphManager.getWorkingMemory(), null, 2) }] };

      case "set_current_topic":
        if (args && typeof args.topic === 'string') {
          knowledgeGraphManager.setCurrentTopic(args.topic);
          return { content: [{ type: "text", text: `Current topic set to: ${args.topic}` }] };
        }
        return { content: [{ type: "text", text: "No topic provided" }] };

      case "process_user_message":
        // Simplified implementation
        if (!args || typeof args.message !== 'string') return { content: [{ type: "text", text: "No message provided" }] };
        
        const message = args.message.toString().toLowerCase();
        const triggers: string[] = [];
        
        if (/remember|told you|mentioned|said|earlier|previously|last time/i.test(message)) {
          triggers.push("retrieve");
        }
        
        if (/remember this|note this|keep track|don't forget|save this/i.test(message)) {
          triggers.push("store");
        }
        
        if (/not correct|wrong|actually|instead|rather|update/i.test(message)) {
          triggers.push("update");
        }
        
        return { content: [{ type: "text", text: JSON.stringify(triggers, null, 2) }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error(`Error handling tool call ${name}:`, error);
    throw error;
  }
});

// Load the graph data initially and start the server
knowledgeGraphManager.readGraph(false)
  .then(() => {
    console.error('MCP Knowledge Graph Server ready');
    
    const transport = new StdioServerTransport();
    server.connect(transport)
      .then(() => {
        console.error("Knowledge Graph MCP Server running on stdio");
      })
      .catch((error: any) => {
        console.error("Error connecting to transport:", error);
        process.exit(1);
      });
  })
  .catch((error: any) => {
    console.error('Failed to initialize knowledge graph:', error);
    process.exit(1);
  });