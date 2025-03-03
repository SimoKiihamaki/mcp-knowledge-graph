# MCP Knowledge Graph - Cursor Setup Instructions

This guide helps you set up the MCP Knowledge Graph server to work correctly with Cursor.

## Overview

The Knowledge Graph server implements the Model Context Protocol (MCP) to provide AI assistants with memory and knowledge graph capabilities. It offers several tools:

- `search_nodes`: Search for entities in the knowledge graph
- `read_graph`: Read the entire knowledge graph structure
- `create_entities`: Create new entities in the knowledge graph
- And more...

## Setup Instructions

### 1. Build the Project

First, make sure you've built the project:

```bash
npm install
npm run build
```

### 2. Configure Cursor

To enable the MCP server in Cursor, you need to copy the `cursor-config.json` file to Cursor's configuration directory:

**Windows:**
```
%APPDATA%\Cursor\cursor_config.json
```

**macOS:**
```
~/Library/Application Support/Cursor/cursor_config.json
```

**Linux:**
```
~/.config/Cursor/cursor_config.json
```

If the file already exists, merge the `mcpServers` section from our `cursor-config.json` with your existing configuration.

### 3. Start Cursor with MCP Enabled

1. Close and restart Cursor completely
2. Create or open a conversation
3. You should see the MCP Knowledge Graph server tools available

## Troubleshooting

If the tools aren't showing up:

1. Check the Cursor logs for any connection errors
2. Make sure the server is correctly built (`npm run build`)
3. Test the server standalone by running `npm start`
4. Verify your `cursor_config.json` file has the correct path to the server

## Available Tools

Once connected, you can use the following tools in your AI conversations:

- **search_nodes**: Search the knowledge graph by keyword
  ```
  search_nodes({ "query": "your search terms" })
  ```

- **read_graph**: Get the full knowledge graph
  ```
  read_graph({})
  ```

- **create_entities**: Add new entities to the knowledge graph
  ```
  create_entities({
    "entities": [
      {
        "name": "EntityName",
        "entityType": "Component",
        "observations": ["This is an observation"]
      }
    ]
  })
  ```

## Additional Resources

For more details on the Model Context Protocol, see:
- [MCP Documentation](https://modelcontextprotocol.io/docs)
- [Cursor MCP Integration](https://docs.cursor.sh/user-manual/mcp-integration) 