import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { Entity, SearchFilter } from '../types/interfaces.js';
import { calculateStringDistance } from '../core/utils.js';

/**
 * Manages search operations for the knowledge graph
 */
export class SearchManager {
  private knowledgeGraphManager: KnowledgeGraphManager;

  /**
   * Create a new SearchManager
   * @param knowledgeGraphManager The knowledge graph manager instance
   */
  constructor(knowledgeGraphManager: KnowledgeGraphManager) {
    this.knowledgeGraphManager = knowledgeGraphManager;
  }

  /**
   * Perform a search based on filters
   */
  async search(filter: SearchFilter): Promise<Entity[]> {
    // Get graph summary
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Apply filters to summaries
    let filteredEntities = graph.entities;
    
    // Filter by project
    if (filter.projectId) {
      filteredEntities = filteredEntities.filter(entity => 
        entity.projectId === filter.projectId
      );
    }
    
    // Filter by entity types
    if (filter.entityTypes && filter.entityTypes.length > 0) {
      filteredEntities = filteredEntities.filter(entity => 
        filter.entityTypes?.includes(entity.entityType)
      );
    }
    
    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      filteredEntities = filteredEntities.filter(entity => 
        entity.tags && filter.tags?.some(tag => entity.tags?.includes(tag))
      );
    }
    
    // Filter by parent entity
    if (filter.parentEntity) {
      filteredEntities = filteredEntities.filter(entity => 
        entity.parentEntity === filter.parentEntity
      );
    }
    
    // Filter for root entities only
    if (filter.onlyRootEntities) {
      filteredEntities = filteredEntities.filter(entity => 
        !entity.parentEntity
      );
    }
    
    // Filter by deprecated status
    if (!filter.includeDeprecated) {
      filteredEntities = filteredEntities.filter(entity => 
        !entity.isDeprecated
      );
    }
    
    // Get full entities for the filtered summaries
    const fullEntities: Entity[] = [];
    for (const summary of filteredEntities) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        fullEntities.push(entity);
      }
    }
    
    // Apply filters that require the full entity
    let results = fullEntities;
    
    // Filter by creation date
    if (filter.createdAfter) {
      results = results.filter(entity => 
        entity.createdAt && entity.createdAt > filter.createdAfter!
      );
    }
    
    // Apply text search if query is provided
    if (filter.query) {
      results = this.applyTextSearch(results, filter.query);
    }
    
    // Sort by relevance score if provided
    results = this.rankResults(results, filter);
    
    // Filter by minimum relevance
    if (filter.minRelevance !== undefined) {
      results = results.filter(entity => 
        (entity.relevanceScore || 0) >= (filter.minRelevance || 0)
      );
    }
    
    // Apply limit if provided
    if (filter.limit && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }
    
    return results;
  }
  
  /**
   * Apply text search to entities
   * @private
   */
  private applyTextSearch(entities: Entity[], query: string): Entity[] {
    const normalizedQuery = query.toLowerCase();
    const results: Array<Entity & { searchScore: number }> = [];
    
    for (const entity of entities) {
      // Calculate a search score based on matches in different fields
      let searchScore = 0;
      
      // Check name (highest weight)
      if (entity.name.toLowerCase().includes(normalizedQuery)) {
        searchScore += 10;
      }
      
      // Check type (medium weight)
      if (entity.entityType.toLowerCase().includes(normalizedQuery)) {
        searchScore += 5;
      }
      
      // Check tags (medium weight)
      if (entity.tags && entity.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))) {
        searchScore += 5;
      }
      
      // Check observations (lowest weight but still important)
      if (entity.observations) {
        for (const observation of entity.observations) {
          if (observation.toLowerCase().includes(normalizedQuery)) {
            searchScore += 3;
            break; // Only count once
          }
        }
      }
      
      // Calculate string similarity for fuzzy match
      const nameSimilarity = calculateStringDistance(entity.name.toLowerCase(), normalizedQuery);
      if (nameSimilarity > 0.6) { // Threshold for fuzzy matching
        searchScore += nameSimilarity * 7; // Scale by similarity
      }
      
      // Add to results if there's any match
      if (searchScore > 0) {
        results.push({
          ...entity,
          searchScore,
          relevanceScore: searchScore / 20 // Normalize to 0-1 scale (max score would be ~20)
        });
      }
    }
    
    // Sort by search score
    return results
      .sort((a, b) => b.searchScore - a.searchScore)
      .map(({ searchScore, ...entity }) => entity); // Remove the temporary score
  }
  
  /**
   * Rank search results
   * @private
   */
  private rankResults(entities: Entity[], filter: SearchFilter): Entity[] {
    // If no query was provided, use a simpler ranking
    if (!filter.query) {
      return entities.map(entity => ({
        ...entity,
        relevanceScore: entity.accessCount ? Math.min(entity.accessCount / 10, 1) : 0.1
      })).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }
    
    // Otherwise, the search score is already set by applyTextSearch
    return entities;
  }
  
  /**
   * Search for entities by name
   */
  async searchByName(name: string, limit: number = 10): Promise<Entity[]> {
    return this.search({
      query: name,
      limit
    });
  }
  
  /**
   * Search for entities by type
   */
  async searchByType(entityType: string, limit: number = 10): Promise<Entity[]> {
    return this.search({
      entityTypes: [entityType],
      limit
    });
  }
  
  /**
   * Advanced search combining multiple filters
   */
  async advancedSearch(
    query?: string,
    entityTypes?: string[],
    projectId?: string,
    tags?: string[],
    parentEntity?: string,
    limit: number = 10
  ): Promise<Entity[]> {
    return this.search({
      query,
      entityTypes,
      projectId,
      tags,
      parentEntity,
      limit,
      includeDeprecated: false
    });
  }
  
  /**
   * Hierarchical search - find entities and their descendants
   */
  async hierarchicalSearch(
    rootEntityName: string,
    maxDepth: number = -1, // -1 means unlimited
    includeRoot: boolean = true
  ): Promise<Entity[]> {
    const rootEntity = await this.knowledgeGraphManager.getEntity(rootEntityName);
    if (!rootEntity) {
      return [];
    }
    
    const results: Entity[] = includeRoot ? [rootEntity] : [];
    
    // Helper function to traverse the hierarchy
    const traverseChildren = async (
      entityName: string,
      currentDepth: number
    ): Promise<void> => {
      // Stop if we've reached the max depth
      if (maxDepth >= 0 && currentDepth > maxDepth) {
        return;
      }
      
      const entity = await this.knowledgeGraphManager.getEntity(entityName);
      if (!entity || !entity.children || entity.children.length === 0) {
        return;
      }
      
      // Process each child
      for (const childName of entity.children) {
        const childEntity = await this.knowledgeGraphManager.getEntity(childName);
        if (childEntity) {
          results.push(childEntity);
          // Recursively process this child's children
          await traverseChildren(childName, currentDepth + 1);
        }
      }
    };
    
    // Start traversal from the root
    await traverseChildren(rootEntityName, 1);
    
    return results;
  }
  
  /**
   * Search for entities involved in a specific relation type
   */
  async searchByRelation(
    relationType: string,
    entityName?: string,
    direction: 'from' | 'to' | 'both' = 'both'
  ): Promise<Entity[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    
    // Filter relations by type
    let filteredRelations = graph.relations.filter(
      relation => relation.relationType === relationType
    );
    
    // If entity name is provided, filter by entity
    if (entityName) {
      if (direction === 'from' || direction === 'both') {
        filteredRelations = filteredRelations.filter(
          relation => relation.from === entityName
        );
      }
      
      if (direction === 'to' || direction === 'both') {
        filteredRelations = filteredRelations.filter(
          relation => relation.to === entityName
        );
      }
    }
    
    // Collect entity names
    const entityNames = new Set<string>();
    for (const relation of filteredRelations) {
      if (direction === 'from' || direction === 'both') {
        entityNames.add(relation.from);
      }
      
      if (direction === 'to' || direction === 'both') {
        entityNames.add(relation.to);
      }
    }
    
    // Get full entities
    const entities: Entity[] = [];
    for (const name of entityNames) {
      const entity = await this.knowledgeGraphManager.getEntity(name);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
}