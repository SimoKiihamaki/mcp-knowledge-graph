import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { Entity, MemoryHealthMetrics } from '../types/interfaces.js';
import { calculateStringDistance, getDateDaysAgo } from '../core/utils.js';

/**
 * Manages health and maintenance operations for the knowledge graph
 */
export class MemoryHealthManager {
  private knowledgeGraphManager: KnowledgeGraphManager;
  private readonly STALE_THRESHOLD_DAYS = 60; // Consider entities not accessed in 60 days as stale
  private readonly SIMILARITY_THRESHOLD = 0.85; // Threshold for detecting possible duplicates

  /**
   * Create a new MemoryHealthManager
   * @param knowledgeGraphManager The knowledge graph manager instance
   */
  constructor(knowledgeGraphManager: KnowledgeGraphManager) {
    this.knowledgeGraphManager = knowledgeGraphManager;
  }

  /**
   * Get health metrics for the knowledge graph
   */
  async getMemoryHealth(projectId?: string): Promise<MemoryHealthMetrics> {
    // Get full graph summary
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Filter by project if needed
    const filteredEntities = projectId
      ? graph.entities.filter(entity => entity.projectId === projectId)
      : graph.entities;
    
    const filteredRelations = projectId
      ? graph.relations.filter(relation => {
          // Find the entities for this relation
          const fromEntity = graph.entities.find(e => e.name === relation.from);
          const toEntity = graph.entities.find(e => e.name === relation.to);
          
          // Relation is in project if either entity is in the project
          return (fromEntity && fromEntity.projectId === projectId) ||
                 (toEntity && toEntity.projectId === projectId);
        })
      : graph.relations;
    
    // Get full entities for detailed metrics
    const fullEntities: Entity[] = [];
    for (const summary of filteredEntities) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        fullEntities.push(entity);
      }
    }
    
    // Calculate entity counts by project
    const entitiesByProject = new Map<string, number>();
    for (const entity of filteredEntities) {
      if (entity.projectId) {
        const count = entitiesByProject.get(entity.projectId) || 0;
        entitiesByProject.set(entity.projectId, count + 1);
      }
    }
    
    // Calculate entity counts by type
    const entitiesByType = new Map<string, number>();
    for (const entity of filteredEntities) {
      const count = entitiesByType.get(entity.entityType) || 0;
      entitiesByType.set(entity.entityType, count + 1);
    }
    
    // Find stale entities (not accessed in a while)
    const staleDate = getDateDaysAgo(this.STALE_THRESHOLD_DAYS);
    const staleEntities = fullEntities.filter(entity => {
      // Skip entities without lastAccessed date
      if (!entity.lastAccessed) return false;
      
      return entity.lastAccessed < staleDate;
    });
    
    // Find untagged entities
    const untaggedEntities = fullEntities.filter(
      entity => !entity.tags || entity.tags.length === 0
    );
    
    // Find orphaned entities (no relations)
    const orphanedEntities = fullEntities.filter(entity => {
      const hasRelations = filteredRelations.some(
        relation => relation.from === entity.name || relation.to === entity.name
      );
      return !hasRelations;
    });
    
    // Find possible duplicates using string similarity
    const possibleDuplicates: { entities: Entity[]; similarity: number }[] = [];
    
    // Only compare entities of the same type
    const entitiesByEntityType = new Map<string, Entity[]>();
    for (const entity of fullEntities) {
      const entities = entitiesByEntityType.get(entity.entityType) || [];
      entities.push(entity);
      entitiesByEntityType.set(entity.entityType, entities);
    }
    
    // Check each type group
    for (const [_, entities] of entitiesByEntityType.entries()) {
      // Skip if there's only one entity
      if (entities.length <= 1) continue;
      
      // Compare each entity with every other entity
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entityA = entities[i];
          const entityB = entities[j];
          
          // Calculate similarity between entity names
          const similarity = calculateStringDistance(entityA.name, entityB.name);
          
          if (similarity >= this.SIMILARITY_THRESHOLD) {
            possibleDuplicates.push({
              entities: [entityA, entityB],
              similarity
            });
          }
        }
      }
    }
    
    // Calculate hierarchy stats
    const rootEntities = filteredEntities.filter(entity => !entity.parentEntity);
    
    // Calculate max depth
    let maxDepth = 0;
    const calculateDepth = (entityName: string, currentDepth: number): void => {
      maxDepth = Math.max(maxDepth, currentDepth);
      
      // Find children
      const entity = filteredEntities.find(e => e.name === entityName);
      if (entity && entity.hasChildren) {
        // Find actual children
        const children = filteredEntities.filter(e => e.parentEntity === entityName);
        for (const child of children) {
          calculateDepth(child.name, currentDepth + 1);
        }
      }
    };
    
    // Calculate depth for each root entity
    for (const rootEntity of rootEntities) {
      calculateDepth(rootEntity.name, 1);
    }
    
    // Calculate average children per parent
    let totalChildren = 0;
    let parentCount = 0;
    
    for (const entity of filteredEntities) {
      if (entity.hasChildren) {
        parentCount++;
        // Count actual children
        const childrenCount = filteredEntities.filter(e => e.parentEntity === entity.name).length;
        totalChildren += childrenCount;
      }
    }
    
    const avgChildrenPerParent = parentCount > 0 ? totalChildren / parentCount : 0;
    
    // Compile health metrics
    return {
      totalEntities: filteredEntities.length,
      totalRelations: filteredRelations.length,
      entitiesByProject: Array.from(entitiesByProject.entries()).map(([projectId, count]) => ({
        projectId,
        count
      })),
      entitiesByType: Array.from(entitiesByType.entries()).map(([entityType, count]) => ({
        entityType,
        count
      })),
      staleEntities,
      untaggedEntities,
      orphanedEntities,
      possibleDuplicates,
      hierarchyStats: {
        rootEntities: rootEntities.length,
        maxDepth,
        avgChildrenPerParent
      }
    };
  }
  
  /**
   * Identify similar entities that might be duplicates
   */
  async findPossibleDuplicates(
    entityType?: string,
    projectId?: string,
    similarityThreshold: number = this.SIMILARITY_THRESHOLD
  ): Promise<{ pair: [Entity, Entity]; similarity: number }[]> {
    // Get full graph
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Filter entities
    let filteredEntities = graph.entities;
    
    if (entityType) {
      filteredEntities = filteredEntities.filter(entity => entity.entityType === entityType);
    }
    
    if (projectId) {
      filteredEntities = filteredEntities.filter(entity => entity.projectId === projectId);
    }
    
    // Get full entities
    const fullEntities: Entity[] = [];
    for (const summary of filteredEntities) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        fullEntities.push(entity);
      }
    }
    
    // Find duplicates
    const duplicates: { pair: [Entity, Entity]; similarity: number }[] = [];
    
    for (let i = 0; i < fullEntities.length; i++) {
      for (let j = i + 1; j < fullEntities.length; j++) {
        const entityA = fullEntities[i];
        const entityB = fullEntities[j];
        
        // Calculate similarity
        const nameSimilarity = calculateStringDistance(entityA.name, entityB.name);
        
        if (nameSimilarity >= similarityThreshold) {
          duplicates.push({
            pair: [entityA, entityB],
            similarity: nameSimilarity
          });
        }
      }
    }
    
    // Sort by similarity (highest first)
    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }
  
  /**
   * Mark an entity as deprecated instead of deleting it
   */
  async deprecateEntity(entityName: string): Promise<Entity | null> {
    return this.knowledgeGraphManager.deprecateEntity(entityName);
  }
  
  /**
   * Find and return stale entities (not accessed in a while)
   */
  async findStaleEntities(
    thresholdDays: number = this.STALE_THRESHOLD_DAYS,
    projectId?: string
  ): Promise<Entity[]> {
    // Get full graph
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Filter entities
    let filteredEntities = graph.entities;
    
    if (projectId) {
      filteredEntities = filteredEntities.filter(entity => entity.projectId === projectId);
    }
    
    // Get full entities
    const fullEntities: Entity[] = [];
    for (const summary of filteredEntities) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        fullEntities.push(entity);
      }
    }
    
    // Find stale entities
    const staleDate = getDateDaysAgo(thresholdDays);
    return fullEntities.filter(entity => {
      // Skip entities without lastAccessed date
      if (!entity.lastAccessed) return false;
      
      return entity.lastAccessed < staleDate;
    });
  }
  
  /**
   * Find orphaned entities (entities with no relations)
   */
  async findOrphanedEntities(projectId?: string): Promise<Entity[]> {
    // Get full graph
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Filter entities
    let filteredEntities = graph.entities;
    
    if (projectId) {
      filteredEntities = filteredEntities.filter(entity => entity.projectId === projectId);
    }
    
    // Get full entities
    const fullEntities: Entity[] = [];
    for (const summary of filteredEntities) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        fullEntities.push(entity);
      }
    }
    
    // Find orphaned entities
    return fullEntities.filter(entity => {
      const hasRelations = graph.relations.some(
        relation => relation.from === entity.name || relation.to === entity.name
      );
      return !hasRelations;
    });
  }
} 