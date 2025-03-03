// Utility functions for the MCP Knowledge Graph

/**
 * Detects memory-related triggers in user messages
 */
export function detectMemoryTriggers(userMessage: string): string[] {
  const triggers = [];
  
  // Reference to past knowledge
  if (/remember|told you|mentioned|said|earlier|previously|last time/i.test(userMessage)) {
    triggers.push('retrieve');
  }
  
  // Request to remember something
  if (/remember this|note this|keep track|don't forget|save this/i.test(userMessage)) {
    triggers.push('store');
  }
  
  // Correcting existing information
  if (/not correct|wrong|actually|instead|rather|update/i.test(userMessage)) {
    triggers.push('update');
  }
  
  return triggers;
}

/**
 * Calculates string similarity using Levenshtein distance
 */
export function calculateStringDistance(a: string, b: string): number {
  // Convert to lowercase for comparison
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  
  // Levenshtein distance calculation
  const track = Array(s2.length + 1).fill(null).map(() => 
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Return similarity as 1 - normalized distance
  return 1 - distance / maxLength;
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Gets a date X days ago as ISO timestamp
 */
export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Safely accesses nested properties without throwing errors
 */
export function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | undefined {
  return obj ? obj[key] : undefined;
}

/**
 * Documentation standards to guide AI models
 */
export const documentationStandards = {
  entityNaming: [
    "Use specific, unique identifiers (e.g., 'John_Smith' not just 'John')",
    "Be consistent with naming conventions (camelCase for most entities)",
    "Include a category prefix for common entity types (person_John, project_Dashboard)"
  ],
  whatToDocument: [
    "User preferences and important personal details",
    "Project requirements, specifications, and deadlines",
    "Technical decisions and their rationale",
    "Problems encountered and their solutions",
    "Information explicitly requested to be remembered"
  ],
  observationFormat: [
    "Write complete sentences with proper context",
    "Include dates for time-sensitive information",
    "Be specific and precise",
    "Include attribution when relevant (e.g., 'User mentioned on 2025-03-01...')"
  ],
  relationshipTypes: [
    "Use active voice and clear directionality",
    "Common types: creates, manages, dependsOn, uses, contains, resolves",
    "Maintain consistency across similar relationships"
  ]
}; 