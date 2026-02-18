/**
 * @deprecated This file is deprecated and kept only for backward compatibility.
 * Please use the modular structure from './git/' instead.
 *
 * @example
 * ```typescript
 * // Old way (deprecated)
 * import { getBranches } from './gitService';
 *
 * // New way (recommended)
 * import { getBranches } from './git';
 * ```
 *
 * This file will be removed in a future version.
 * All functionality has been moved to organized modules in './git/':
 * - types.ts - Type definitions
 * - repository.ts - Repository operations
 * - branches.ts - Branch operations
 * - commits.ts - Commit operations
 * - files.ts - File operations
 * - fileTree.ts - File tree operations
 * - graph.ts - Graph visualization
 * - remotes.ts - Remote operations
 * - stash.ts - Stash operations
 * - tags.ts - Tag operations
 * - conflicts.ts - Conflict resolution
 * - rebase.ts - Rebase operations
 * - search.ts - Search operations
 * - reflog.ts - Reflog operations
 * - blame.ts - Blame operations
 */

// Re-export everything from the new modular structure
export * from "./git";

// The original 3944-line monolithic file has been refactored into 16 focused modules
// Migration completed: 100%
// Status: Deprecated - Use './git' instead
