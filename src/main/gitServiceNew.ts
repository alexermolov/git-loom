// New modular Git Service
// This file re-exports all git operations from the modular structure in ./git/

// Export all types
export * from "./git/types";

// Export repository operations
export * from "./git/repository";

// Export branch operations
export * from "./git/branches";

// Export commit operations
export * from "./git/commits";

// Export file operations
export * from "./git/files";

// Export file tree operations
export * from "./git/fileTree";

// Export graph operations
export * from "./git/graph";

// Export remote operations
export * from "./git/remotes";

// Export stash operations
export * from "./git/stash";

// Export tag operations
export * from "./git/tags";

// Export conflict resolution operations
export * from "./git/conflicts";

// Export rebase operations
export * from "./git/rebase";

// Export search operations
export * from "./git/search";

// Export reflog operations
export * from "./git/reflog";

// Export blame operations
export * from "./git/blame";

// All git operations are now available through this single import point
// Usage:
// import { getBranches, createCommit, getFileTree, ... } from './gitServiceNew';
