#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KnowledgeGraphManager } from './src/core/KnowledgeGraphManager';
import { ProjectManager } from './src/managers/ProjectManager';
import { TagManager } from './src/managers/TagManager';
import { SearchManager } from './src/managers/SearchManager';
import { MemoryHealthManager } from './src/managers/MemoryHealthManager';
import { Entity, Relation } from './src/types/interfaces';
import { startHttpServer } from './src/server/httpServer';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'memory-path': { type: 'string' },
    'port': { type: 'string' },
    'verbose': { type: 'boolean' }
  },
  strict: false
});

// Configure memory paths
const memoryPath = values['memory-path']?.toString() || './memory.jsonl';
const workingMemoryPath = path.join(path.dirname(memoryPath), 'working_memory.json');
const port = parseInt(values['port']?.toString() || '3002', 10);
const verbose = !!values['verbose'];

// Initialize managers
const knowledgeGraphManager = new KnowledgeGraphManager(memoryPath, workingMemoryPath);
const projectManager = new ProjectManager(knowledgeGraphManager);
const tagManager = new TagManager(knowledgeGraphManager);
const searchManager = new SearchManager(knowledgeGraphManager);
const memoryHealthManager = new MemoryHealthManager(knowledgeGraphManager);

// Initialize server
console.error('MCP Knowledge Graph Server initializing...');

// Start HTTP server
const httpServer = startHttpServer(knowledgeGraphManager, searchManager, port);

// Define tools for MCP compliance
const mcpTools = [
  {
    name: "search_nodes",
    description: "Search for entities in the knowledge graph by keyword",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The keyword or phrase to search for in entity names, types, and observations"
        },
        entityTypes: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Optional list of entity types to filter by"
        },
        projectId: {
          type: "string",
          description: "Optional project ID to filter by"
        },
        tags: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Optional list of tags to filter by"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "read_graph",
    description: "Read the entire knowledge graph structure",
    parameters: {
      type: "object",
      properties: {
        includeObservations: {
          type: "boolean",
          description: "Whether to include all observations (default: false)"
        }
      }
    }
  },
  {
    name: "create_entities",
    description: "Create new entities in the knowledge graph",
    parameters: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Unique name for the entity"
              },
              entityType: {
                type: "string",
                description: "Type of the entity (e.g., 'Component', 'Bug', 'Architecture')"
              },
              observations: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "List of observations about the entity"
              }
            },
            required: ["name", "entityType"]
          }
        }
      },
      required: ["entities"]
    }
  }
];

// Set up JSON-RPC over stdin/stdout
process.stdin.setEncoding('utf8');

// Define request type
interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: any;
}

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  tryProcessMessages();
});

function tryProcessMessages() {
  // Process complete messages from buffer
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const message = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    
    try {
      const request = JSON.parse(message);
      handleMessage(request);
    } catch (error) {
      console.error('Failed to parse message:', error);
      sendErrorResponse(null, -32700, 'Parse error');
    }
  }
}

async function handleMessage(request: JsonRpcRequest) {
  console.error(`Received message: ${request.method}`);
  
  // Check for required JSON-RPC fields
  if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
    return sendErrorResponse(request.id, -32600, 'Invalid Request');
  }
  
  try {
    switch (request.method) {
      case 'initialize':
        // Handle MCP initialization with tool discovery
        console.error('Initializing MCP server with tool registration');
        sendResponse(request.id, {
          protocolVersion: request.params.protocolVersion,
          serverInfo: {
            name: 'mcp-knowledge-graph',
            version: '1.0.0'
          },
          capabilities: {
            tools: {
              list: mcpTools
            }
          }
        });
        break;
        
      case 'read_graph':
        const graphData = await knowledgeGraphManager.readGraph(false);
        sendResponse(request.id, graphData);
        break;
        
      case 'create_entities':
        if (Array.isArray(request.params.entities)) {
          for (const entity of request.params.entities) {
            await knowledgeGraphManager.createEntity(
              entity.name,
              entity.entityType,
              entity.observations || [],
              entity.projectId,
              entity.parentEntity,
              entity.tags
            );
          }
        }
        sendResponse(request.id, { success: true });
        break;
        
      case 'create_relations':
        if (Array.isArray(request.params.relations)) {
          for (const relation of request.params.relations) {
            await knowledgeGraphManager.createRelation(
              relation.from,
              relation.to,
              relation.relationType,
              relation.metadata
            );
          }
        }
        sendResponse(request.id, { success: true });
        break;
        
      case 'add_observations':
        if (Array.isArray(request.params.observations)) {
          for (const observation of request.params.observations) {
            const entity = await knowledgeGraphManager.getEntity(observation.entityName);
            if (entity) {
              await knowledgeGraphManager.updateEntity(
                observation.entityName,
                { observations: [...entity.observations, observation.contents] }
              );
            }
          }
        }
        sendResponse(request.id, { success: true });
        break;
        
      case 'search_nodes':
        // Use SearchManager's search functionality
        const results = await searchManager.search(request.params.query);
        sendResponse(request.id, { results });
        break;
        
      case 'open_nodes':
        const nodes = await Promise.all(
          request.params.names.map((name: string) => 
            knowledgeGraphManager.getEntity(name)
          )
        );
        sendResponse(request.id, { nodes: nodes.filter(node => node !== null) });
        break;
        
      case 'get_recent_entities':
        // We need to get all entities with full details for this
        // First get all entity names, then retrieve their details
        const summaryGraph = await knowledgeGraphManager.readGraph(false);
        const entityNames = summaryGraph.entities.map(e => e.name);
        
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
          .slice(0, request.params.limit || 5);
        
        sendResponse(request.id, { entities: recentEntities });
        break;
        
      case 'get_working_memory':
        const workingMemory = knowledgeGraphManager.getWorkingMemory();
        sendResponse(request.id, workingMemory);
        break;
        
      case 'set_current_topic':
        knowledgeGraphManager.setCurrentTopic(request.params.topic);
        sendResponse(request.id, { success: true });
        break;
        
      default:
        sendErrorResponse(request.id, -32601, 'Method not found');
        break;
    }
  } catch (error: unknown) {
    console.error(`Error handling "${request.method}":`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendErrorResponse(request.id, -32603, `Internal error: ${errorMessage}`);
  }
}

function sendResponse(id: number | string | null, result: any) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendErrorResponse(id: number | string | null, code: number, message: string) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: { code, message }
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Load the graph data initially
knowledgeGraphManager.readGraph(false)
  .then(() => {
    console.error('MCP Knowledge Graph Server ready');
    console.error(`HTTP Server listening on port ${port}`);
  })
  .catch((error: any) => {
    console.error('Failed to initialize knowledge graph:', error);
    process.exit(1);
  });
