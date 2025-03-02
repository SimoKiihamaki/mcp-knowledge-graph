#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import { isAbsolute } from 'path';

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

// We are storing our memory using entities, relations, and observations in a graph structure
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string; // ISO timestamp for creation
  lastAccessed?: string; // ISO timestamp for last access
  accessCount?: number; // Number of times this entity was accessed
  relevanceScore?: number; // Score indicating relevance (can be computed)
}

// Lightweight entity with only name and type
interface EntitySummary {
  name: string;
  entityType: string;
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string; // ISO timestamp for creation
  lastAccessed?: string; // ISO timestamp for last access
  metadata?: {
    confidence?: number; // How confident we are in this relation (0-1)
    source?: string; // Where this relation was derived from
    notes?: string; // Any additional context
  };
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

// Add a simplified graph structure with only names and types
interface SummaryKnowledgeGraph {
  entities: EntitySummary[];
  relations: Relation[];
}

// Define the working memory context structure
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

// Function usage guidelines to help AI models
interface FunctionGuidelines {
  function: string;
  whenToUse: string[];
  whenNotToUse: string[];
  bestPractices: string[];
  examples: {input: any, context: string, explanation: string}[];
}

// Documentation standards to guide AI models
const documentationStandards = {
  entityNaming: [
    "Use specific, unique identifiers (e.g., 'John_Smith' not just 'John')",
    "Be consistent with naming conventions (camelCase for most entities)",
    "Include a category prefix for common entity types (person_John, project_Dashboard)"
  ],
  whatToDocument: [
    "User preferences and important personal details",
    "Project-specific information with long-term value",
    "Recurring topics that appear across multiple conversations",
    "Explicit instructions for future reference",
    "Information the user explicitly asks to remember"
  ],
  whatNotToDocument: [
    "Casual conversation without specific knowledge value",
    "Highly sensitive personal information",
    "Temporary instructions only relevant to the current session",
    "Information explicitly stated as confidential"
  ],
  observationFormatting: [
    "Write in complete, clear statements",
    "Include contextual information (when/where this was learned)",
    "Note certainty level if information is ambiguous",
    "Format dates consistently (YYYY-MM-DD)"
  ]
};

// Guidelines for each function
const functionGuidelines: Record<string, FunctionGuidelines> = {
  read_graph: {
    function: "read_graph",
    whenToUse: [
      "At the beginning of a conversation to check existing knowledge",
      "When the user refers to something you might have stored previously",
      "When confirming if certain information is already known"
    ],
    whenNotToUse: [
      "After every user message (would waste context space)",
      "When you're confident the information being discussed is new"
    ],
    bestPractices: [
      "Use open_nodes for specific entities to get full details when needed",
      "Follow up with open_nodes for specific entities rather than downloading everything"
    ],
    examples: [
      {
        input: {},
        context: "User asks: 'What do you know about my team?'",
        explanation: "Check for existing knowledge before responding"
      }
    ]
  },
  create_entities: {
    function: "create_entities",
    whenToUse: [
      "When learning about new subjects, people, or concepts",
      "When a user explicitly provides information they want remembered",
      "When establishing a new topic that will likely be referenced later"
    ],
    whenNotToUse: [
      "For ephemeral or trivial information",
      "For entities already known to exist (use add_observations instead)",
      "For information the user indicates should be private"
    ],
    bestPractices: [
      "Use descriptive, unique names",
      "Choose appropriate entity types that align with the information's nature",
      "Include initial observations that clearly identify the entity"
    ],
    examples: [
      {
        input: {
          entities: [
            {
              name: "project_Dashboard",
              entityType: "Project",
              observations: ["A data visualization project started on 2025-01-15"]
            }
          ]
        },
        context: "User says: 'I'm working on a dashboard project that started last month.'",
        explanation: "Creates a new project entity with identifying information"
      }
    ]
  },
  search_nodes: {
    function: "search_nodes",
    whenToUse: [
      "When user asks about a specific topic you might have information on",
      "When recognizing references to previously discussed topics",
      "When exploring related concepts to current discussion"
    ],
    whenNotToUse: [
      "When exact entity names are already known (use open_nodes instead)",
      "For general keyword searches unrelated to memory retrieval"
    ],
    bestPractices: [
      "Use specific search terms to reduce context window usage",
      "Follow up with more specific queries as needed",
      "Use information from the search to guide the conversation"
    ],
    examples: [
      {
        input: {query: "dashboard"},
        context: "User mentions: 'Let's continue our discussion about the dashboard.'",
        explanation: "Searches for any entities related to 'dashboard' to recall context"
      }
    ]
  }
};

// Helper function to detect triggers for memory operations
function detectMemoryTriggers(userMessage: string): string[] {
  const triggers = [];
  
  // Reference to past knowledge
  if (/remember|told you|mentioned|said|earlier|previously|last time/i.test(userMessage)) {
    triggers.push('retrieve');
  }
  
  // Request to remember something
  if (/remember this|note this|keep track|don't forget|save this/i.test(userMessage)) {
    triggers.push('store');
  }
  
  // Correcting existing information
  if (/not correct|wrong|actually|instead|rather|update/i.test(userMessage)) {
    triggers.push('update');
  }
  
  return triggers;
}

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
class KnowledgeGraphManager {
  private workingMemory: WorkingMemoryContext;

  constructor() {
    // Initialize working memory with defaults
    this.workingMemory = {
      activeEntities: [],
      recentlyDiscussed: [],
      currentTopic: "",
      pendingInformation: [],
      lastUpdated: new Date().toISOString()
    };
    
    // Try to load working memory if it exists
    this.loadWorkingMemory().catch(() => {
      // If it fails, we'll use the default initialized above
      this.saveWorkingMemory();
    });
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(MEMORY_FILE_PATH, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      return lines.reduce((graph: KnowledgeGraph, line) => {
        const item = JSON.parse(line);
        if (item.type === "entity") graph.entities.push(item as Entity);
        if (item.type === "relation") graph.relations.push(item as Relation);
        return graph;
      }, { entities: [], relations: [] });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map(e => JSON.stringify({ type: "entity", ...e })),
      ...graph.relations.map(r => JSON.stringify({ type: "relation", ...r })),
    ];
    await fs.writeFile(MEMORY_FILE_PATH, lines.join("\n"));
  }

  private async loadWorkingMemory(): Promise<void> {
    try {
      const data = await fs.readFile(WORKING_MEMORY_PATH, "utf-8");
      this.workingMemory = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or can't be parsed, we'll use the default
      console.error("Working memory could not be loaded, using default");
    }
  }

  private async saveWorkingMemory(): Promise<void> {
    try {
      this.workingMemory.lastUpdated = new Date().toISOString();
      await fs.writeFile(WORKING_MEMORY_PATH, JSON.stringify(this.workingMemory, null, 2));
    } catch (error) {
      console.error("Failed to save working memory", error);
    }
  }

  // Update entity access timestamps and counters
  private updateEntityAccess(entityName: string): void {
    const now = new Date().toISOString();
    
    // Update in working memory
    if (!this.workingMemory.activeEntities.includes(entityName)) {
      this.workingMemory.activeEntities.push(entityName);
    }
    
    // Update recently discussed
    const recentIndex = this.workingMemory.recentlyDiscussed.findIndex(item => item.entity === entityName);
    if (recentIndex >= 0) {
      // Update existing entry
      this.workingMemory.recentlyDiscussed[recentIndex].timestamp = now;
      this.workingMemory.recentlyDiscussed[recentIndex].relevanceScore += 0.1;
    } else {
      // Add new entry
      this.workingMemory.recentlyDiscussed.push({
        entity: entityName,
        timestamp: now,
        relevanceScore: 1.0
      });
    }
    
    // Sort by relevance score and keep only the top 10
    this.workingMemory.recentlyDiscussed.sort((a, b) => b.relevanceScore - a.relevanceScore);
    if (this.workingMemory.recentlyDiscussed.length > 10) {
      this.workingMemory.recentlyDiscussed = this.workingMemory.recentlyDiscussed.slice(0, 10);
    }
    
    // Save working memory
    this.saveWorkingMemory();
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const now = new Date().toISOString();
    const graph = await this.loadGraph();
    
    // Add timestamps and initialize counters
    const timestampedEntities = entities.map(e => ({
      ...e,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      relevanceScore: 1.0
    }));
    
    const newEntities = timestampedEntities.filter(e => !graph.entities.some(existingEntity => existingEntity.name === e.name));
    graph.entities.push(...newEntities);
    await this.saveGraph(graph);
    
    // Update working memory
    newEntities.forEach(entity => {
      this.updateEntityAccess(entity.name);
    });
    
    return newEntities;
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const now = new Date().toISOString();
    const graph = await this.loadGraph();
    
    // Add timestamps
    const timestampedRelations = relations.map(r => ({
      ...r,
      createdAt: now,
      lastAccessed: now,
      metadata: {
        confidence: 1.0,
        source: "user_input"
      }
    }));
    
    const newRelations = timestampedRelations.filter(r => !graph.relations.some(existingRelation =>
      existingRelation.from === r.from &&
      existingRelation.to === r.to &&
      existingRelation.relationType === r.relationType
    ));
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    
    // Update working memory for all entities involved in relations
    const uniqueEntities = new Set<string>();
    newRelations.forEach(relation => {
      uniqueEntities.add(relation.from);
      uniqueEntities.add(relation.to);
    });
    
    uniqueEntities.forEach(entityName => {
      this.updateEntityAccess(entityName);
    });
    
    return newRelations;
  }

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const now = new Date().toISOString();
    
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      
      // Update access timestamp and counter
      entity.lastAccessed = now;
      entity.accessCount = (entity.accessCount || 0) + 1;
      entity.relevanceScore = (entity.relevanceScore || 0) + 0.1;
      
      // Add new observations
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      
      // Update working memory
      this.updateEntityAccess(o.entityName);
      
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    await this.saveGraph(graph);
    
    // Update working memory
    this.workingMemory.activeEntities = this.workingMemory.activeEntities.filter(
      name => !entityNames.includes(name)
    );
    this.workingMemory.recentlyDiscussed = this.workingMemory.recentlyDiscussed.filter(
      item => !entityNames.includes(item.entity)
    );
    await this.saveWorkingMemory();
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    const graph = await this.loadGraph();
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
        
        // Update access timestamp 
        entity.lastAccessed = new Date().toISOString();
      }
    });
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(r => !relations.some(delRelation =>
      r.from === delRelation.from &&
      r.to === delRelation.to &&
      r.relationType === delRelation.relationType
    ));
    await this.saveGraph(graph);
  }

  // Modified to ALWAYS return summary mode, ignoring fullDetails parameter
  async readGraph(fullDetails: boolean = false): Promise<SummaryKnowledgeGraph> {
    const graph = await this.loadGraph();
    
    // Update access timestamps for all entities, even though we won't return full details
    const now = new Date().toISOString();
    graph.entities.forEach(entity => {
      entity.lastAccessed = now;
      entity.accessCount = (entity.accessCount || 0) + 1;
    });
    await this.saveGraph(graph);
    
    // Always return the lightweight version regardless of fullDetails parameter
    return {
      entities: graph.entities.map(entity => ({
        name: entity.name,
        entityType: entity.entityType
      })),
      relations: graph.relations
    };
  }

  // Very basic search function
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const now = new Date().toISOString();

    // Filter entities
    const filteredEntities = graph.entities.filter(e =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.entityType.toLowerCase().includes(query.toLowerCase()) ||
      e.observations.some(o => o.toLowerCase().includes(query.toLowerCase()))
    );

    // Update access timestamps for matched entities
    filteredEntities.forEach(entity => {
      entity.lastAccessed = now;
      entity.accessCount = (entity.accessCount || 0) + 1;
      entity.relevanceScore = (entity.relevanceScore || 0) + 0.1;
      
      // Update working memory
      this.updateEntityAccess(entity.name);
    });

    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    const filteredGraph: KnowledgeGraph = {
      entities: filteredEntities,
      relations: filteredRelations,
    };

    // Save updated timestamps
    await this.saveGraph(graph);
    
    return filteredGraph;
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const now = new Date().toISOString();

    // Filter entities
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
    
    // Update access timestamps for matched entities
    filteredEntities.forEach(entity => {
      entity.lastAccessed = now;
      entity.accessCount = (entity.accessCount || 0) + 1;
      entity.relevanceScore = (entity.relevanceScore || 0) + 0.1;
      
      // Update working memory
      this.updateEntityAccess(entity.name);
    });

    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    const filteredGraph: KnowledgeGraph = {
      entities: filteredEntities,
      relations: filteredRelations,
    };
    
    // Save updated timestamps
    await this.saveGraph(graph);

    return filteredGraph;
  }
  
  // New function to get most recently accessed entities
  async getRecentEntities(limit: number = 5): Promise<Entity[]> {
    const graph = await this.loadGraph();
    
    // Get entities sorted by last accessed time (most recent first)
    const sortedEntities = [...graph.entities]
      .filter(e => e.lastAccessed) // Ensure lastAccessed exists
      .sort((a, b) => {
        // Default to empty string if undefined
        const aTime = a.lastAccessed || "";
        const bTime = b.lastAccessed || "";
        // Sort in descending order (most recent first)
        return bTime.localeCompare(aTime);
      });
    
    return sortedEntities.slice(0, limit);
  }
  
  // New function to get most relevant entities based on current working context
  async getRelevantEntities(limit: number = 5): Promise<Entity[]> {
    const graph = await this.loadGraph();
    
    // Get entities from working memory's recently discussed list
    const relevantNames = this.workingMemory.recentlyDiscussed
      .map(item => item.entity)
      .slice(0, limit);
    
    // Find these entities in the graph
    const relevantEntities = graph.entities.filter(
      entity => relevantNames.includes(entity.name)
    );
    
    return relevantEntities;
  }
  
  // Get function usage guidelines
  getFunctionGuidelines(functionName?: string): any {
    if (functionName && functionGuidelines[functionName]) {
      return functionGuidelines[functionName];
    }
    
    // Return all guidelines if no specific function requested
    return functionGuidelines;
  }
  
  // Get documentation standards
  getDocumentationStandards(): any {
    return documentationStandards;
  }
  
  // Get current working memory context
  getWorkingMemory(): WorkingMemoryContext {
    return this.workingMemory;
  }
  
  // Set the current conversation topic
  setCurrentTopic(topic: string): void {
    this.workingMemory.currentTopic = topic;
    this.saveWorkingMemory();
  }
  
  // Process a user message to detect when to use memory functions
  processUserMessage(message: string): string[] {
    const triggers = detectMemoryTriggers(message);
    
    // If we detect a potential memory operation, add it to pending information
    if (triggers.length > 0) {
      this.workingMemory.pendingInformation.push({
        message,
        triggers,
        timestamp: new Date().toISOString()
      });
      this.saveWorkingMemory();
    }
    
    return triggers;
  }
}

const knowledgeGraphManager = new KnowledgeGraphManager();


// The server instance and tools exposed to Claude
const server = new Server({
  name: "mcp-knowledge-graph",
  version: "1.0.1",
},    {
    capabilities: {
      tools: {},
    },
  },);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
                },
                required: ["name", "entityType", "observations"],
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
        name: "delete_observations",
        description: "Delete specific observations from entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity containing the observations" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observations to delete"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "Delete multiple relations from the knowledge graph",
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
                },
                required: ["from", "to", "relationType"],
              },
              description: "An array of relations to delete"
            },
          },
          required: ["relations"],
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
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
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
      {
        name: "get_recent_entities",
        description: "Get the most recently accessed entities from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            limit: { 
              type: "number", 
              description: "Maximum number of entities to return (default: 5)" 
            },
          },
        },
      },
      {
        name: "get_relevant_entities",
        description: "Get the most relevant entities based on the current conversation context",
        inputSchema: {
          type: "object",
          properties: {
            limit: { 
              type: "number", 
              description: "Maximum number of entities to return (default: 5)" 
            },
          },
        },
      },
      {
        name: "get_function_guidelines",
        description: "Get usage guidelines for knowledge graph functions to understand when and how to use them",
        inputSchema: {
          type: "object",
          properties: {
            functionName: { 
              type: "string", 
              description: "Specific function to get guidelines for (optional, returns all if not specified)" 
            },
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
            topic: { 
              type: "string", 
              description: "The current topic of conversation" 
            },
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
            message: { 
              type: "string", 
              description: "The user's message to analyze" 
            },
          },
          required: ["message"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args && name !== "get_documentation_standards" && name !== "get_working_memory") {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "create_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createEntities(args.entities as Entity[]), null, 2) }] };
    case "create_relations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createRelations(args.relations as Relation[]), null, 2) }] };
    case "add_observations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addObservations(args.observations as { entityName: string; contents: string[] }[]), null, 2) }] };
    case "delete_entities":
      await knowledgeGraphManager.deleteEntities(args.entityNames as string[]);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    case "delete_observations":
      await knowledgeGraphManager.deleteObservations(args.deletions as { entityName: string; observations: string[] }[]);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    case "delete_relations":
      await knowledgeGraphManager.deleteRelations(args.relations as Relation[]);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    case "read_graph":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.readGraph(), null, 2) }] };
    case "search_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args.query as string), null, 2) }] };
    case "open_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.openNodes(args.names as string[]), null, 2) }] };
    case "get_recent_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getRecentEntities(args.limit as number || 5), null, 2) }] };
    case "get_relevant_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getRelevantEntities(args.limit as number || 5), null, 2) }] };
    case "get_function_guidelines":
      return { content: [{ type: "text", text: JSON.stringify(knowledgeGraphManager.getFunctionGuidelines(args.functionName as string), null, 2) }] };
    case "get_documentation_standards":
      return { content: [{ type: "text", text: JSON.stringify(knowledgeGraphManager.getDocumentationStandards(), null, 2) }] };
    case "get_working_memory":
      return { content: [{ type: "text", text: JSON.stringify(knowledgeGraphManager.getWorkingMemory(), null, 2) }] };
    case "set_current_topic":
      knowledgeGraphManager.setCurrentTopic(args.topic as string);
      return { content: [{ type: "text", text: `Current topic set to: ${args.topic}` }] };
    case "process_user_message":
      return { content: [{ type: "text", text: JSON.stringify(knowledgeGraphManager.processUserMessage(args.message as string), null, 2) }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
