import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { Entity, EntitySummary } from '../types/interfaces.js';

/**
 * Manages tag operations for entities in the knowledge graph
 */
export class TagManager {
  private knowledgeGraphManager: KnowledgeGraphManager;

  /**
   * Create a new TagManager
   * @param knowledgeGraphManager The knowledge graph manager instance
   */
  constructor(knowledgeGraphManager: KnowledgeGraphManager) {
    this.knowledgeGraphManager = knowledgeGraphManager;
  }

  /**
   * Add tags to an entity
   */
  async addTags(entityName: string, tags: string[]): Promise<Entity | null> {
    // Get the entity
    const entity = await this.knowledgeGraphManager.getEntity(entityName);
    
    if (!entity) {
      return null;
    }
    
    // Combine existing tags with new ones, avoiding duplicates
    const existingTags = entity.tags || [];
    const uniqueTags = Array.from(new Set([...existingTags, ...tags]));
    
    // Update the entity
    return this.knowledgeGraphManager.updateEntity(entityName, {
      tags: uniqueTags
    });
  }
  
  /**
   * Remove tags from an entity
   */
  async removeTags(entityName: string, tags: string[]): Promise<Entity | null> {
    // Get the entity
    const entity = await this.knowledgeGraphManager.getEntity(entityName);
    
    if (!entity) {
      return null;
    }
    
    // Remove specified tags
    const existingTags = entity.tags || [];
    const updatedTags = existingTags.filter(tag => !tags.includes(tag));
    
    // Update the entity
    return this.knowledgeGraphManager.updateEntity(entityName, {
      tags: updatedTags
    });
  }
  
  /**
   * Get all entities with a specific tag
   */
  async getEntitiesByTag(tag: string, projectId?: string): Promise<Entity[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    const summaries = graph.entities.filter(entity => {
      // Check if entity has the tag
      const hasTag = entity.tags && entity.tags.includes(tag);
      
      // If projectId is specified, filter by project
      if (projectId) {
        return hasTag && entity.projectId === projectId;
      }
      
      return hasTag;
    });
    
    // Fetch full entities from summaries
    const entities: Entity[] = [];
    for (const summary of summaries) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  /**
   * Get all tags used in the system
   */
  async getAllTags(projectId?: string): Promise<{ tag: string; count: number }[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Filter entities by project if specified
    const entities = projectId 
      ? graph.entities.filter(entity => entity.projectId === projectId)
      : graph.entities;
    
    // Collect all tags and count occurrences
    const tagCounts = new Map<string, number>();
    
    for (const entity of entities) {
      if (entity.tags) {
        for (const tag of entity.tags) {
          const currentCount = tagCounts.get(tag) || 0;
          tagCounts.set(tag, currentCount + 1);
        }
      }
    }
    
    // Convert to array of objects
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({
      tag,
      count
    })).sort((a, b) => b.count - a.count); // Sort by count descending
  }
  
  /**
   * Get entities with any of the specified tags
   */
  async getEntitiesByAnyTag(tags: string[], projectId?: string): Promise<Entity[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    const summaries = graph.entities.filter(entity => {
      // Check if entity has any of the tags
      const hasAnyTag = entity.tags && entity.tags.some(tag => tags.includes(tag));
      
      // If projectId is specified, filter by project
      if (projectId) {
        return hasAnyTag && entity.projectId === projectId;
      }
      
      return hasAnyTag;
    });
    
    // Fetch full entities from summaries
    const entities: Entity[] = [];
    for (const summary of summaries) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  /**
   * Get entities with all of the specified tags
   */
  async getEntitiesByAllTags(tags: string[], projectId?: string): Promise<Entity[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    const summaries = graph.entities.filter(entity => {
      // Check if entity has all the tags
      const hasAllTags = entity.tags && 
        tags.every(tag => entity.tags?.includes(tag));
      
      // If projectId is specified, filter by project
      if (projectId) {
        return hasAllTags && entity.projectId === projectId;
      }
      
      return hasAllTags;
    });
    
    // Fetch full entities from summaries
    const entities: Entity[] = [];
    for (const summary of summaries) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  /**
   * Find related tags (tags that frequently appear together)
   */
  async getRelatedTags(tag: string, projectId?: string): Promise<{ tag: string; cooccurrence: number }[]> {
    // Get entities with the specified tag
    const entities = await this.getEntitiesByTag(tag, projectId);
    
    // Count co-occurrence of other tags
    const cooccurrenceCounts = new Map<string, number>();
    
    for (const entity of entities) {
      if (entity.tags) {
        for (const entityTag of entity.tags) {
          // Skip the original tag
          if (entityTag === tag) continue;
          
          const currentCount = cooccurrenceCounts.get(entityTag) || 0;
          cooccurrenceCounts.set(entityTag, currentCount + 1);
        }
      }
    }
    
    // Convert to array of objects
    return Array.from(cooccurrenceCounts.entries()).map(([relatedTag, count]) => ({
      tag: relatedTag,
      cooccurrence: count
    })).sort((a, b) => b.cooccurrence - a.cooccurrence); // Sort by co-occurrence descending
  }
  
  /**
   * Find entities with no tags
   */
  async getUntaggedEntities(projectId?: string): Promise<Entity[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    const summaries = graph.entities.filter(entity => {
      const isUntagged = !entity.tags || entity.tags.length === 0;
      
      // If projectId is specified, filter by project
      if (projectId) {
        return isUntagged && entity.projectId === projectId;
      }
      
      return isUntagged;
    });
    
    // Fetch full entities from summaries
    const entities: Entity[] = [];
    for (const summary of summaries) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
}