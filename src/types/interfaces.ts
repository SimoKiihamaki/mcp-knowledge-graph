// Interface definitions for the MCP Knowledge Graph

// Entity interfaces
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  projectId?: string; // Project this entity belongs to
  tags?: string[]; // Custom tags for categorization
  parentEntity?: string; // Parent entity for hierarchical structure
  children?: string[]; // Child entities for hierarchical structure
  createdAt?: string; // ISO timestamp for creation
  lastAccessed?: string; // ISO timestamp for last access
  accessCount?: number; // Number of times this entity was accessed
  relevanceScore?: number; // Score indicating relevance (can be computed)
  isDeprecated?: boolean; // Whether this entity is deprecated
}

// Lightweight entity with only name and type
export interface EntitySummary {
  name: string;
  entityType: string;
  projectId?: string; // Project this entity belongs to
  tags?: string[]; // Custom tags for categorization
  parentEntity?: string; // Parent entity for hierarchical structure
  hasChildren?: boolean; // Whether this entity has children
  isDeprecated?: boolean; // Whether this entity is deprecated
}

// Relation between entities
export interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string; // ISO timestamp for creation
  lastAccessed?: string; // ISO timestamp for last access
  metadata?: {
    confidence?: number; // How confident we are in this relation (0-1)
    source?: string; // Where this relation was derived from
    notes?: string; // Any additional context
  };
}

// Complete knowledge graph structure
export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

// Simplified graph structure with only names and types
export interface SummaryKnowledgeGraph {
  entities: EntitySummary[];
  relations: Relation[];
}

// Working memory context
export interface WorkingMemoryContext {
  activeEntities: string[]; // Currently active entities in conversation
  recentlyDiscussed: {
    entity: string,
    timestamp: string, // ISO timestamp
    relevanceScore: number
  }[];
  currentProject?: string; // Current active project
  recentProjects: {
    projectId: string,
    lastAccessed: string // ISO timestamp
  }[];
  currentTopic: string;
  pendingInformation: any[];
  lastUpdated: string; // ISO timestamp
}

// Function usage guidelines to help AI models
export interface FunctionGuidelines {
  function: string;
  whenToUse: string[];
  whenNotToUse: string[];
  bestPractices: string[];
  examples: {input: any, context: string, explanation: string}[];
}

// Project metadata entity type
export interface ProjectEntity extends Entity {
  entityType: 'Project'; // Always 'Project' for project entities
  projectId: string; // Same as name for self-reference
  description?: string; // Project description
  status?: 'active' | 'archived' | 'completed';
  startDate?: string; // ISO timestamp for project start
  endDate?: string; // ISO timestamp for project end
}

// Search filter interface
export interface SearchFilter {
  query?: string;
  entityTypes?: string[];
  projectId?: string;
  tags?: string[]; // Filter by tags
  parentEntity?: string; // Filter by parent entity
  onlyRootEntities?: boolean; // Only return entities with no parent
  createdAfter?: string;
  minRelevance?: number;
  limit?: number;
  includeDeprecated?: boolean; // Whether to include deprecated entities
}

// Memory health metrics interface
export interface MemoryHealthMetrics {
  totalEntities: number;
  totalRelations: number;
  entitiesByProject: {
    projectId: string;
    count: number;
  }[];
  entitiesByType: {
    entityType: string;
    count: number;
  }[];
  staleEntities: Entity[]; // Entities not accessed in a long time
  untaggedEntities: Entity[]; // Entities without tags
  orphanedEntities: Entity[]; // Entities without relations
  possibleDuplicates: {
    entities: Entity[];
    similarity: number;
  }[];
  hierarchyStats: {
    rootEntities: number;
    maxDepth: number;
    avgChildrenPerParent: number;
  };
} 