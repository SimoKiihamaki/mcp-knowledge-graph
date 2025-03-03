import express from 'express';
import cors from 'cors';
import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { SearchManager } from '../managers/SearchManager.js';

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
  },
  {
    name: "add_observations",
    description: "Add observations to existing entities",
    parameters: {
      type: "object",
      properties: {
        observations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entityName: {
                type: "string",
                description: "Name of the entity to add observations to"
              },
              contents: {
                type: "string",
                description: "The content of the observation to add"
              }
            },
            required: ["entityName", "contents"]
          }
        }
      },
      required: ["observations"]
    }
  }
];

export function startHttpServer(
  knowledgeGraphManager: KnowledgeGraphManager,
  searchManager: SearchManager,
  port: number = 3002
) {
  const app = express();
  
  // Configure middleware
  app.use(cors());
  app.use(express.json());
  
  // Define JSON-RPC endpoint
  app.post('/jsonrpc', async (req, res) => {
    console.error(`HTTP Server received request: ${req.body.method}`);
    
    const { jsonrpc, id, method, params } = req.body;
    
    // Validate JSON-RPC request
    if (!jsonrpc || jsonrpc !== '2.0' || !method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request' }
      });
    }
    
    try {
      let result;
      
      // Handle methods with the correct prefix structure
      if (method === 'initialize') {
        // Handle MCP initialization with tool discovery
        console.error('HTTP Server: Initializing MCP server with tool registration');
        result = {
          protocolVersion: params.protocolVersion || '0.1.0',
          serverInfo: {
            name: 'mcp-knowledge-graph',
            version: '1.0.0'
          },
          capabilities: {
            tools: mcpTools
          }
        };
      } else if (method.startsWith('tools/')) {
        // Extract tool name from method path
        const toolName = method.substring('tools/'.length);
        
        switch (toolName) {
          case 'search_nodes':
            console.error('HTTP Server: Handling search_nodes request');
            const searchResults = await searchManager.search(params.query);
            result = { results: searchResults };
            break;
            
          case 'create_entities':
            console.error('HTTP Server: Handling create_entities request');
            if (Array.isArray(params.entities)) {
              for (const entity of params.entities) {
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
            result = { success: true };
            break;
            
          case 'add_observations':
            console.error('HTTP Server: Handling add_observations request');
            if (Array.isArray(params.observations)) {
              for (const observation of params.observations) {
                const entity = await knowledgeGraphManager.getEntity(observation.entityName);
                if (entity) {
                  await knowledgeGraphManager.updateEntity(
                    observation.entityName,
                    { observations: [...entity.observations, observation.contents] }
                  );
                }
              }
            }
            result = { success: true };
            break;
            
          default:
            // Handle method not found
            return res.status(404).json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Method not found: ${toolName}` }
            });
        }
      } else {
        // Direct method call (backward compatibility)
        switch (method) {
          case 'read_graph':
            result = await knowledgeGraphManager.readGraph(false);
            break;
            
          case 'open_nodes':
            const nodes = await Promise.all(
              params.names.map((name: string) =>
                knowledgeGraphManager.getEntity(name)
              )
            );
            result = { nodes: nodes.filter(node => node !== null) };
            break;
            
          default:
            // Handle method not found
            return res.status(404).json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Method not found: ${method}` }
            });
        }
      }
      
      // Send response
      return res.json({
        jsonrpc: '2.0',
        id,
        result
      });
      
    } catch (error: unknown) {
      console.error(`Error handling "${method}":`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: `Internal error: ${errorMessage}` }
      });
    }
  });
  
  // Add health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Start the server
  const server = app.listen(port, () => {
    console.error(`HTTP Server listening on port ${port}`);
  });
  
  return server;
} 