import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { ProjectEntity, Entity, EntitySummary } from '../types/interfaces.js';
import { getCurrentTimestamp } from '../core/utils.js';

/**
 * Manages project-related operations for the knowledge graph
 */
export class ProjectManager {
  private knowledgeGraphManager: KnowledgeGraphManager;

  /**
   * Create a new ProjectManager
   * @param knowledgeGraphManager The knowledge graph manager instance
   */
  constructor(knowledgeGraphManager: KnowledgeGraphManager) {
    this.knowledgeGraphManager = knowledgeGraphManager;
  }

  /**
   * Create a new project
   */
  async createProject(
    projectName: string,
    description?: string
  ): Promise<ProjectEntity> {
    const timestamp = getCurrentTimestamp();
    
    // Create project entity
    const projectEntity = await this.knowledgeGraphManager.createEntity(
      projectName,
      'Project',
      description ? [description] : ['No description provided'],
      projectName,  // projectId is same as name for projects
      undefined,    // No parent for projects
      ['project']   // Always tag with 'project'
    ) as ProjectEntity;
    
    // Add additional project-specific fields
    const updatedProject = await this.knowledgeGraphManager.updateEntity(
      projectName,
      {
        observations: projectEntity.observations,
        entityType: 'Project',
      }
    ) as ProjectEntity;
    
    // Update working memory
    const workingMemory = this.knowledgeGraphManager.getWorkingMemory();
    workingMemory.recentProjects.unshift({
      projectId: projectName,
      lastAccessed: timestamp
    });
    
    // Keep only the 5 most recent projects
    if (workingMemory.recentProjects.length > 5) {
      workingMemory.recentProjects = workingMemory.recentProjects.slice(0, 5);
    }
    
    return updatedProject;
  }
  
  /**
   * Get a project by ID
   */
  async getProject(projectId: string): Promise<ProjectEntity | null> {
    const entity = await this.knowledgeGraphManager.getEntity(projectId);
    
    if (entity && entity.entityType === 'Project') {
      return entity as ProjectEntity;
    }
    
    return null;
  }
  
  /**
   * List all projects
   */
  async listProjects(): Promise<ProjectEntity[]> {
    const graph = await this.knowledgeGraphManager.readGraph();
    const projectSummaries = graph.entities.filter(entity => entity.entityType === 'Project');
    
    // Convert summaries to full entities
    const projects: ProjectEntity[] = [];
    for (const summary of projectSummaries) {
      const project = await this.knowledgeGraphManager.getEntity(summary.name);
      if (project && project.entityType === 'Project') {
        projects.push(project as ProjectEntity);
      }
    }
    
    return projects;
  }
  
  /**
   * Set the current active project
   */
  async setCurrentProject(projectId: string): Promise<boolean> {
    // Verify project exists
    const project = await this.getProject(projectId);
    if (!project) {
      return false;
    }
    
    // Update working memory
    const workingMemory = this.knowledgeGraphManager.getWorkingMemory();
    workingMemory.currentProject = projectId;
    
    // Update recent projects
    const timestamp = getCurrentTimestamp();
    const existingIndex = workingMemory.recentProjects.findIndex(p => p.projectId === projectId);
    
    if (existingIndex !== -1) {
      // Move to the top
      workingMemory.recentProjects.splice(existingIndex, 1);
    }
    
    workingMemory.recentProjects.unshift({
      projectId,
      lastAccessed: timestamp
    });
    
    // Keep only the 5 most recent projects
    if (workingMemory.recentProjects.length > 5) {
      workingMemory.recentProjects = workingMemory.recentProjects.slice(0, 5);
    }
    
    return true;
  }
  
  /**
   * Get the current active project
   */
  async getCurrentProject(): Promise<ProjectEntity | null> {
    const workingMemory = this.knowledgeGraphManager.getWorkingMemory();
    
    if (!workingMemory.currentProject) {
      return null;
    }
    
    return this.getProject(workingMemory.currentProject);
  }
  
  /**
   * Read all entities for a project
   */
  async readProjectGraph(projectId: string): Promise<Entity[]> {
    // We need to get the full entities, not just summaries
    const projectSummaries = (await this.knowledgeGraphManager.readGraph()).entities
      .filter(entity => entity.projectId === projectId && !entity.isDeprecated);
    
    // Fetch full entities from summaries
    const projectEntities: Entity[] = [];
    for (const summary of projectSummaries) {
      const entity = await this.knowledgeGraphManager.getEntity(summary.name);
      if (entity) {
        projectEntities.push(entity);
      }
    }
    
    return projectEntities;
  }
  
  /**
   * Update project metadata
   */
  async updateProject(
    projectId: string,
    updates: {
      description?: string;
      status?: 'active' | 'archived' | 'completed';
      endDate?: string;
    }
  ): Promise<ProjectEntity | null> {
    const project = await this.getProject(projectId);
    
    if (!project) {
      return null;
    }
    
    // Prepare observations update if description is provided
    let observations: string[] | undefined = undefined;
    if (updates.description) {
      observations = [updates.description];
    }
    
    // Update the project entity
    const updatedProject = await this.knowledgeGraphManager.updateEntity(
      projectId,
      {
        observations,
      }
    ) as ProjectEntity;
    
    return updatedProject;
  }
  
  /**
   * Archive a project
   */
  async archiveProject(projectId: string): Promise<ProjectEntity | null> {
    return this.updateProject(projectId, { status: 'archived' });
  }
  
  /**
   * Complete a project
   */
  async completeProject(projectId: string): Promise<ProjectEntity | null> {
    const timestamp = getCurrentTimestamp();
    return this.updateProject(projectId, { 
      status: 'completed',
      endDate: timestamp
    });
  }
  
  /**
   * Get recent projects
   */
  async getRecentProjects(): Promise<ProjectEntity[]> {
    const workingMemory = this.knowledgeGraphManager.getWorkingMemory();
    const projectIds = workingMemory.recentProjects.map(p => p.projectId);
    
    const projects: ProjectEntity[] = [];
    for (const projectId of projectIds) {
      const project = await this.getProject(projectId);
      if (project) {
        projects.push(project);
      }
    }
    
    return projects;
  }
  
  /**
   * Delete a project and all its entities
   */
  async deleteProject(projectId: string): Promise<boolean> {
    const project = await this.getProject(projectId);
    
    if (!project) {
      return false;
    }
    
    // First, read all the entities in the project
    const projectEntities = await this.readProjectGraph(projectId);
    
    // Delete all entities in the project
    for (const entity of projectEntities) {
      // Skip the project entity itself, we'll delete it last
      if (entity.name === projectId) continue;
      
      await this.knowledgeGraphManager.deleteEntity(entity.name);
    }
    
    // Finally, delete the project entity
    await this.knowledgeGraphManager.deleteEntity(projectId);
    
    // Update working memory
    const workingMemory = this.knowledgeGraphManager.getWorkingMemory();
    
    // Remove from recent projects
    workingMemory.recentProjects = workingMemory.recentProjects.filter(
      p => p.projectId !== projectId
    );
    
    // Clear current project if it was this one
    if (workingMemory.currentProject === projectId) {
      workingMemory.currentProject = undefined;
    }
    
    return true;
  }
} 