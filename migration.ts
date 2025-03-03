import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { Entity, Relation } from './src/types/interfaces.js';

const getCurrentTimestamp = () => new Date().toISOString();

async function migrateMemory(oldFilePath: string, newFilePath: string) {
  try {
    console.log('='.repeat(50));
    console.log(`MEMORY MIGRATION TOOL`);
    console.log('='.repeat(50));
    console.log(`Starting migration from ${oldFilePath} to ${newFilePath}`);
    
    // Check if source file exists
    if (!existsSync(oldFilePath)) {
      console.error(`ERROR: Source file ${oldFilePath} does not exist!`);
      return;
    }
    
    // Create backup of the old file
    const backupPath = `${oldFilePath}.backup.${Date.now()}`;
    await fs.copyFile(oldFilePath, backupPath);
    console.log(`✅ Created backup at ${backupPath}`);
    
    // Create readable stream
    const fileStream = createReadStream(oldFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    console.log(`🔍 Parsing entities and relations...`);
    
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    let lineCount = 0;
    
    // Process each line
    for await (const line of rl) {
      lineCount++;
      if (!line.trim()) continue;
      
      try {
        const record = JSON.parse(line);
        
        // Handle entity records
        if (record.type === 'entity') {
          const newEntity: Entity = {
            name: record.name,
            entityType: record.entityType || 'Unknown',
            observations: record.observations || [],
            projectId: record.projectId,
            tags: record.tags || [],
            parentEntity: record.parentEntity,
            children: record.children || [],
            createdAt: record.createdAt || getCurrentTimestamp(),
            lastAccessed: record.lastAccessed || getCurrentTimestamp(),
            accessCount: record.accessCount || 0,
            relevanceScore: record.relevanceScore || 0,
            isDeprecated: record.isDeprecated || false
          };
          
          entities.push(newEntity);
          console.log(`  ➕ Entity: ${newEntity.name} (${newEntity.entityType})`);
        }
        // Handle relation records
        else if (record.type === 'relation') {
          const newRelation: Relation = {
            from: record.from,
            to: record.to,
            relationType: record.relationType || 'unknown',
            metadata: record.metadata || {}
          };
          
          relations.push(newRelation);
          console.log(`  🔗 Relation: ${newRelation.from} --[${newRelation.relationType}]--> ${newRelation.to}`);
        }
      } catch (error) {
        console.error(`❌ Error processing line ${lineCount}: ${line.substring(0, 50)}...`);
        console.error(error);
      }
    }
    
    console.log(`✅ Finished parsing ${lineCount} lines`);
    console.log(`📊 Stats: ${entities.length} entities, ${relations.length} relations`);
    
    console.log(`💾 Writing new memory file...`);
    
    // Create new JSONL file
    const newEntities = entities.map(entity => ({
      type: 'entity',
      data: entity
    }));
    
    const newRelations = relations.map(relation => ({
      type: 'relation',
      data: relation
    }));
    
    const newLines = [...newEntities, ...newRelations]
      .map(record => JSON.stringify(record));
    
    await fs.writeFile(newFilePath, newLines.join('\n'));
    console.log(`✅ Wrote ${newLines.length} records to ${newFilePath}`);
    
    // Create working memory file
    const workingMemoryPath = path.join(path.dirname(newFilePath), 'working_memory.json');
    const workingMemory = {
      activeEntities: [],
      recentlyDiscussed: [],
      currentProject: undefined,
      recentProjects: [],
      currentTopic: "",
      pendingInformation: [],
      lastUpdated: getCurrentTimestamp()
    };
    
    await fs.writeFile(workingMemoryPath, JSON.stringify(workingMemory, null, 2));
    console.log(`✅ Created working memory file at ${workingMemoryPath}`);
    
    console.log('\n' + '='.repeat(50));
    console.log(`MIGRATION COMPLETE!`);
    console.log('='.repeat(50));
    console.log(`📋 Summary:`);
    console.log(`  📄 New memory file: ${newFilePath}`);
    console.log(`  📄 Working memory file: ${workingMemoryPath}`);
    console.log(`  📊 Migrated ${entities.length} entities and ${relations.length} relations`);
    console.log(`  🔄 Original file backed up to: ${backupPath}`);
  } catch (error) {
    console.error('❌ Migration failed with an unexpected error:');
    console.error(error);
  }
}

// Get input and output file paths from command line
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node dist/migration.js <old-memory-path> <new-memory-path>');
  process.exit(1);
}

migrateMemory(args[0], args[1]); 