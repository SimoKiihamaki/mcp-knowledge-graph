import { promises as fs } from 'fs';
import { 
  Entity, 
  KnowledgeGraph, 
  WorkingMemoryContext,
  SummaryKnowledgeGraph,
  EntitySummary,
  Relation
} from '../types/interfaces.js';
import { getCurrentTimestamp } from './utils.js';

/**
 * Core manager for knowledge graph operations
 */
export class KnowledgeGraphManager {
  private memoryFilePath: string;
  private workingMemoryPath: string;
  private workingMemory: WorkingMemoryContext;

  /**
   * Create a new KnowledgeGraphManager
   * @param memoryFilePath Path to the memory file
   * @param workingMemoryPath Path to the working memory file
   */
  constructor(memoryFilePath: string, workingMemoryPath: string) {
    this.memoryFilePath = memoryFilePath;
    this.workingMemoryPath = workingMemoryPath;

    // Initialize working memory with defaults
    this.workingMemory = {
      activeEntities: [],
      recentlyDiscussed: [],
      currentProject: undefined,
      recentProjects: [],
      currentTopic: "",
      pendingInformation: [],
      lastUpdated: getCurrentTimestamp()
    };
    
    // Try to load working memory if it exists
    this.loadWorkingMemory().catch(() => {
      // If it fails, we'll use the default initialized above
      this.saveWorkingMemory();
    });
  }

  /**
   * Load the knowledge graph from file
   */
  protected async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      return lines.reduce((graph: KnowledgeGraph, line) => {
        const item = JSON.parse(line);
        if (item.type === "entity") graph.entities.push(item as Entity);
        if (item.type === "relation") graph.relations.push(item);
        return graph;
      }, { entities: [], relations: [] });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  /**
   * Save the knowledge graph to file
   */
  protected async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map((e: Entity) => JSON.stringify({ type: "entity", ...e })),
      ...graph.relations.map((r: Relation) => JSON.stringify({ type: "relation", ...r })),
    ];
    await fs.writeFile(this.memoryFilePath, lines.join("\n"));
  }

  /**
   * Load working memory from file
   */
  protected async loadWorkingMemory(): Promise<void> {
    try {
      const data = await fs.readFile(this.workingMemoryPath, "utf-8");
      this.workingMemory = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or can't be parsed, we'll use the default
      console.error("Working memory could not be loaded, using default");
    }
  }

  /**
   * Save working memory to file
   */
  protected async saveWorkingMemory(): Promise<void> {
    try {
      this.workingMemory.lastUpdated = getCurrentTimestamp();
      await fs.writeFile(this.workingMemoryPath, JSON.stringify(this.workingMemory, null, 2));
    } catch (error) {
      console.error("Failed to save working memory", error);
    }
  }

  /**
   * Update entity access timestamps and counters
   */
  protected updateEntityAccess(entityName: string): void {
    const now = getCurrentTimestamp();
    
    // Update in working memory
    if (!this.workingMemory.activeEntities.includes(entityName)) {
      this.workingMemory.activeEntities.push(entityName);
    }
    
    // Update recently discussed
    const recentIndex = this.workingMemory.recentlyDiscussed.findIndex(
      (item: { entity: string }) => item.entity === entityName
    );
    
    if (recentIndex !== -1) {
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
    this.workingMemory.recentlyDiscussed.sort((a: { relevanceScore: number }, b: { relevanceScore: number }) => b.relevanceScore - a.relevanceScore);
    if (this.workingMemory.recentlyDiscussed.length > 10) {
      this.workingMemory.recentlyDiscussed = this.workingMemory.recentlyDiscussed.slice(0, 10);
    }
    
    // Save working memory
    this.saveWorkingMemory();
  }
  
  /**
   * Get working memory context
   */
  getWorkingMemory(): WorkingMemoryContext {
    return this.workingMemory;
  }
  
  /**
   * Set current conversation topic
   */
  setCurrentTopic(topic: string): void {
    this.workingMemory.currentTopic = topic;
    this.saveWorkingMemory();
  }
  
  /**
   * Get a summary view of the knowledge graph (without observations)
   */
  async readGraph(fullDetails: boolean = false): Promise<SummaryKnowledgeGraph> {
    const graph = await this.loadGraph();
    
    // Always return the lightweight version regardless of fullDetails parameter
    return {
      entities: graph.entities.map((entity: Entity) => {
        const summary: EntitySummary = {
          name: entity.name,
          entityType: entity.entityType,
          projectId: entity.projectId,
          tags: entity.tags || [],
          parentEntity: entity.parentEntity,
          hasChildren: entity.children && entity.children.length > 0,
          isDeprecated: entity.isDeprecated || false
        };
        return summary;
      }),
      relations: graph.relations
    };
  }
  
  /**
   * Check if an entity exists by name
   */
  async entityExists(entityName: string): Promise<boolean> {
    const graph = await this.loadGraph();
    return graph.entities.some(entity => entity.name === entityName);
  }
  
  /**
   * Get an entity by name
   */
  async getEntity(entityName: string): Promise<Entity | null> {
    const graph = await this.loadGraph();
    const entity = graph.entities.find(entity => entity.name === entityName);
    
    if (entity) {
      this.updateEntityAccess(entityName);
      return entity;
    }
    
    return null;
  }
  
  /**
   * Create a new entity
   */
  async createEntity(
    entityName: string,
    entityType: string,
    observations: string[],
    projectId?: string,
    parentEntity?: string,
    tags?: string[]
  ): Promise<Entity> {
    const graph = await this.loadGraph();
    
    // Check if entity already exists
    if (graph.entities.some(entity => entity.name === entityName)) {
      throw new Error(`Entity with name ${entityName} already exists`);
    }
    
    const timestamp = getCurrentTimestamp();
    
    // Create new entity
    const newEntity: Entity = {
      name: entityName,
      entityType,
      observations,
      lastAccessed: timestamp,
      createdAt: timestamp,
      accessCount: 1,
      tags: tags || [],
      projectId,
      parentEntity,
      children: []
    };
    
    // If this entity has a parent, add it to the parent's children
    if (parentEntity) {
      const parent = graph.entities.find(entity => entity.name === parentEntity);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(entityName);
      } else {
        throw new Error(`Parent entity ${parentEntity} not found`);
      }
    }
    
    graph.entities.push(newEntity);
    await this.saveGraph(graph);
    
    this.updateEntityAccess(entityName);
    
    return newEntity;
  }
  
  /**
   * Update an entity
   */
  async updateEntity(
    entityName: string,
    updates: {
      observations?: string[];
      entityType?: string;
      projectId?: string;
      tags?: string[];
      parentEntity?: string;
      isDeprecated?: boolean;
    }
  ): Promise<Entity | null> {
    const graph = await this.loadGraph();
    const entityIndex = graph.entities.findIndex(entity => entity.name === entityName);
    
    if (entityIndex === -1) {
      return null;
    }
    
    const entity = graph.entities[entityIndex];
    
    // Handle parent entity changes
    if (updates.parentEntity !== undefined && updates.parentEntity !== entity.parentEntity) {
      // Remove from old parent's children if it exists
      if (entity.parentEntity) {
        const oldParentIndex = graph.entities.findIndex(e => e.name === entity.parentEntity);
        if (oldParentIndex !== -1 && graph.entities[oldParentIndex].children) {
          graph.entities[oldParentIndex].children = graph.entities[oldParentIndex].children?.filter(
            child => child !== entityName
          );
        }
      }
      
      // Add to new parent's children if new parent exists
      if (updates.parentEntity) {
        const newParentIndex = graph.entities.findIndex(e => e.name === updates.parentEntity);
        if (newParentIndex !== -1) {
          if (!graph.entities[newParentIndex].children) {
            graph.entities[newParentIndex].children = [];
          }
          graph.entities[newParentIndex].children?.push(entityName);
        } else {
          throw new Error(`New parent entity ${updates.parentEntity} not found`);
        }
      }
    }
    
    // Update entity properties
    if (updates.observations) {
      entity.observations = updates.observations;
    }
    
    if (updates.entityType) {
      entity.entityType = updates.entityType;
    }
    
    if (updates.projectId !== undefined) {
      entity.projectId = updates.projectId;
    }
    
    if (updates.tags) {
      entity.tags = updates.tags;
    }
    
    if (updates.parentEntity !== undefined) {
      entity.parentEntity = updates.parentEntity;
    }
    
    if (updates.isDeprecated !== undefined) {
      entity.isDeprecated = updates.isDeprecated;
    }
    
    // Update metadata
    entity.lastAccessed = getCurrentTimestamp();
    entity.accessCount = (entity.accessCount || 0) + 1;
    
    // Save changes
    graph.entities[entityIndex] = entity;
    await this.saveGraph(graph);
    
    this.updateEntityAccess(entityName);
    
    return entity;
  }
  
  /**
   * Delete an entity and its relations
   */
  async deleteEntity(entityName: string): Promise<boolean> {
    const graph = await this.loadGraph();
    
    // Find entity
    const entityIndex = graph.entities.findIndex(entity => entity.name === entityName);
    if (entityIndex === -1) {
      return false;
    }
    
    const entity = graph.entities[entityIndex];
    
    // Handle parent-child relationships
    if (entity.parentEntity) {
      // Remove from parent's children array
      const parentIndex = graph.entities.findIndex(e => e.name === entity.parentEntity);
      if (parentIndex !== -1 && graph.entities[parentIndex].children) {
        graph.entities[parentIndex].children = graph.entities[parentIndex].children?.filter(
          child => child !== entityName
        );
      }
    }
    
    // If this entity has children, update their parentEntity to null
    if (entity.children && entity.children.length > 0) {
      for (const childName of entity.children) {
        const childIndex = graph.entities.findIndex(e => e.name === childName);
        if (childIndex !== -1) {
          graph.entities[childIndex].parentEntity = undefined;
        }
      }
    }
    
    // Remove entity
    graph.entities.splice(entityIndex, 1);
    
    // Remove relations that involve this entity
    graph.relations = graph.relations.filter(
      relation => relation.from !== entityName && relation.to !== entityName
    );
    
    await this.saveGraph(graph);
    
    // Remove from working memory if present
    this.workingMemory.activeEntities = this.workingMemory.activeEntities.filter(
      e => e !== entityName
    );
    this.workingMemory.recentlyDiscussed = this.workingMemory.recentlyDiscussed.filter(
      item => item.entity !== entityName
    );
    await this.saveWorkingMemory();
    
    return true;
  }
  
  /**
   * Deprecate an entity instead of deleting it
   */
  async deprecateEntity(entityName: string): Promise<Entity | null> {
    return this.updateEntity(entityName, { isDeprecated: true });
  }
  
  /**
   * Create a relation between two entities
   */
  async createRelation(
    sourceEntity: string,
    targetEntity: string,
    relationType: string,
    metadata?: {
      confidence?: number;
      source?: string;
      notes?: string;
    }
  ): Promise<Relation> {
    const graph = await this.loadGraph();
    
    // Verify both entities exist
    const sourceExists = graph.entities.some(entity => entity.name === sourceEntity);
    const targetExists = graph.entities.some(entity => entity.name === targetEntity);
    
    if (!sourceExists) {
      throw new Error(`Source entity ${sourceEntity} does not exist`);
    }
    
    if (!targetExists) {
      throw new Error(`Target entity ${targetEntity} does not exist`);
    }
    
    // Check if relation already exists
    const existingRelation = graph.relations.find(
      relation => 
        relation.from === sourceEntity && 
        relation.to === targetEntity && 
        relation.relationType === relationType
    );
    
    if (existingRelation) {
      throw new Error(`Relation already exists between ${sourceEntity} and ${targetEntity}`);
    }
    
    // Create new relation
    const newRelation: Relation = {
      from: sourceEntity,
      to: targetEntity,
      relationType,
      createdAt: getCurrentTimestamp(),
      metadata: {
        confidence: metadata?.confidence || 1.0,
        source: metadata?.source,
        notes: metadata?.notes
      }
    };
    
    graph.relations.push(newRelation);
    await this.saveGraph(graph);
    
    // Update entity access for both entities
    this.updateEntityAccess(sourceEntity);
    this.updateEntityAccess(targetEntity);
    
    return newRelation;
  }
  
  /**
   * Get relations involving an entity
   */
  async getRelations(
    entityName: string,
    options?: {
      direction?: 'incoming' | 'outgoing' | 'both';
      relationType?: string;
    }
  ): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const direction = options?.direction || 'both';
    
    let relations: Relation[] = [];
    
    if (direction === 'outgoing' || direction === 'both') {
      relations = relations.concat(
        graph.relations.filter(relation => 
          relation.from === entityName &&
          (!options?.relationType || relation.relationType === options.relationType)
        )
      );
    }
    
    if (direction === 'incoming' || direction === 'both') {
      relations = relations.concat(
        graph.relations.filter(relation => 
          relation.to === entityName &&
          (!options?.relationType || relation.relationType === options.relationType)
        )
      );
    }
    
    if (relations.length > 0) {
      this.updateEntityAccess(entityName);
    }
    
    return relations;
  }
  
  /**
   * Delete a relation
   */
  async deleteRelation(
    sourceEntity: string,
    targetEntity: string,
    relationType: string
  ): Promise<boolean> {
    const graph = await this.loadGraph();
    
    const relationIndex = graph.relations.findIndex(
      relation => 
        relation.from === sourceEntity && 
        relation.to === targetEntity && 
        relation.relationType === relationType
    );
    
    if (relationIndex === -1) {
      return false;
    }
    
    graph.relations.splice(relationIndex, 1);
    await this.saveGraph(graph);
    
    return true;
  }
  
  /**
   * Update a relation
   */
  async updateRelation(
    sourceEntity: string,
    targetEntity: string,
    relationType: string,
    updates: {
      confidence?: number;
      notes?: string;
    }
  ): Promise<Relation | null> {
    const graph = await this.loadGraph();
    
    const relationIndex = graph.relations.findIndex(
      relation => 
        relation.from === sourceEntity && 
        relation.to === targetEntity && 
        relation.relationType === relationType
    );
    
    if (relationIndex === -1) {
      return null;
    }
    
    const relation = graph.relations[relationIndex];
    
    if (updates.confidence !== undefined) {
      if (!relation.metadata) relation.metadata = {};
      relation.metadata.confidence = updates.confidence;
    }
    
    if (updates.notes !== undefined) {
      if (!relation.metadata) relation.metadata = {};
      relation.metadata.notes = updates.notes;
    }
    
    graph.relations[relationIndex] = relation;
    await this.saveGraph(graph);
    
    return relation;
  }
}