#!/usr/bin/env node

/**
 * Enhanced Knowledge Graph Memory Server Launcher
 * 
 * This script provides an easy way to start the enhanced memory server
 * with a custom memory path. It's designed to be used in the
 * claude_desktop_config.json file to ensure you're using the enhanced
 * version and not the original memory server.
 * 
 * Usage:
 *   node start-memory-server.js [--memory-path=/path/to/memory.jsonl]
 * 
 * If no memory path is provided, it will use ./memory.jsonl in the current directory.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const minimist = require('minimist');

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
let memoryPath = argv['memory-path'] || path.join(process.cwd(), 'memory.jsonl');

// Ensure the memory path is absolute
if (!path.isAbsolute(memoryPath)) {
  memoryPath = path.resolve(process.cwd(), memoryPath);
}

// Get the directory of this script
const scriptDir = __dirname;

// Path to the compiled index.js file
const serverPath = path.join(scriptDir, 'dist', 'index.js');

// Check if the server file exists
if (!fs.existsSync(serverPath)) {
  console.error(`Error: Server file not found at ${serverPath}`);
  console.error('Please make sure you have built the project with "npm run build"');
  process.exit(1);
}

console.log('Starting Enhanced Knowledge Graph Memory Server');
console.log(`Memory file path: ${memoryPath}`);

// Launch the server
const server = spawn('node', [serverPath, '--memory-path', memoryPath], {
  stdio: ['inherit', 'inherit', 'inherit']
});

console.log('Enhanced Knowledge Graph Memory Server started (PID:', server.pid, ')');

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle script termination
process.on('SIGINT', () => {
  console.log('Shutting down Enhanced Knowledge Graph Memory Server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Shutting down Enhanced Knowledge Graph Memory Server...');
  server.kill('SIGTERM');
});
