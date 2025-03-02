# Setup Guide for Enhanced Knowledge Graph Memory

This guide provides instructions for setting up the enhanced knowledge graph memory server with Claude Desktop or other MCP-compatible clients.

## Local Installation Setup (Recommended)

To ensure you're using the enhanced version (not the original memory server), follow these steps for a local installation:

### Step 1: Clone the Repository

```bash
# Clone the repository to your local machine
git clone https://github.com/SimoKiihamaki/mcp-knowledge-graph.git

# Navigate to the repository directory
cd mcp-knowledge-graph

# Install dependencies
npm install
```

### Step 2: Build the Project

```bash
# Build the TypeScript project
npm run build
```

### Step 3: Configure Claude Desktop

Edit your `claude_desktop_config.json` file (typically located in your home directory) to point to your local installation:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "/full/path/to/mcp-knowledge-graph/dist/index.js",
        "--memory-path", 
        "/path/to/your/memory.jsonl"
      ]
    }
  }
}
```

Replace `/full/path/to/mcp-knowledge-graph/dist/index.js` with the actual full path to the compiled index.js file in your cloned repository.

The `--memory-path` argument is optional. If not specified, the memory file will be created in the same directory as the server.

### Optional: Creating a Package for Easy Distribution

If you want to create a package that can be easily installed:

```bash
# Package the project
npm pack

# This will create a file like mcp-knowledge-graph-1.0.1.tgz
```

Then update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "/path/to/mcp-knowledge-graph-1.0.1.tgz",
        "--memory-path", 
        "/path/to/your/memory.jsonl"
      ]
    }
  }
}
```

## Using a Dedicated Script (Alternative Approach)

Another approach is to create a dedicated script that launches the server:

### Step 1: Create a Launch Script

Create a file named `start-memory-server.js`:

```javascript
const { spawn } = require('child_process');
const path = require('path');

// Path to your compiled index.js file
const serverPath = path.join(__dirname, 'dist', 'index.js');

// Custom memory path if desired
const memoryPath = path.join(__dirname, 'memory.jsonl');

// Launch the server
const server = spawn('node', [serverPath, '--memory-path', memoryPath], {
  stdio: ['inherit', 'inherit', 'inherit']
});

console.log('Knowledge Graph Memory Server started');

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
});
```

### Step 2: Configure Claude Desktop

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "/path/to/start-memory-server.js"
      ]
    }
  }
}
```

## Verifying Your Installation

To verify you're using the enhanced version:

1. Start Claude Desktop
2. In a conversation with Claude, check the available memory functions:
   - Use a prompt like: "What memory functions are available to you? Check for functions like get_working_memory or get_relevant_entities."
3. Claude should mention the enhanced functions like `get_relevant_entities`, `get_function_guidelines`, etc.

## Troubleshooting

If you encounter issues:

1. Check the Claude Desktop logs for any errors
2. Ensure all paths in your configuration are absolute paths
3. Verify that the server is built correctly with `npm run build`
4. Check that all dependencies are installed with `npm install`

If you see mentions of only the basic functions like `read_graph` without the enhanced features, you may still be using the original memory server.
