# Git Operations Module

This directory contains modularized Git operations, refactored from the original monolithic `gitService.ts` file.

## Structure

```
git/
├── index.ts          # Central export point for all Git operations
├── types.ts          # All TypeScript type definitions
├── repository.ts     # Repository scanning and information
├── branches.ts       # Branch management (create, delete, checkout, merge)
├── commits.ts        # Commit operations (create, reset, revert, cherry-pick)
├── files.ts          # File operations (stage, unstage, diff, status)
├── fileTree.ts       # File tree structure building
├── graph.ts          # Git graph visualization
├── remotes.ts        # Remote repository operations
├── stash.ts          # Stash management
├── tags.ts           # Tag operations
├── conflicts.ts      # Conflict resolution
├── rebase.ts         # Interactive rebase operations
├── search.ts         # Commit search and filtering
├── reflog.ts         # Reflog operations
├── blame.ts          # Blame information
└── README.md         # This file
```

## Usage

Import all operations from the central export:

```typescript
import {
  getBranches,
  createBranch,
  getCommits,
  getFileTree,
  scanForRepositories,
  // ... all other functions
} from './git';
```

Or import from specific modules:

```typescript
import { getBranches, createBranch } from './git/branches';
import { getCommits, createCommit } from './git/commits';
```

## Module Descriptions

### `types.ts`
Contains all TypeScript interfaces and type definitions used across Git operations:
- `RepositoryInfo`, `CommitInfo`, `BranchInfo`
- `FileStatus`, `FileDiff`, `FileTreeNode`
- `TagInfo`, `StashEntry`, `ReflogEntry`
- `RebaseCommit`, `RebasePlan`, `RebaseStatus`
- And many more...

### `repository.ts`
Repository-level operations:
- `scanForRepositories(folderPath)` - Recursively scan for Git repositories
- `getRepositoryInfo(repoPath)` - Get detailed repository information including status, branches, commits ahead/behind

### `branches.ts`
Branch management:
- `getBranches(repoPath)` - List all branches with commit info
- `checkoutBranch(repoPath, branchName)` - Switch branches
- `createBranch(repoPath, name, options)` - Create new branch
- `deleteBranch(repoPath, name)` - Delete branch
- `mergeBranch(repoPath, sourceBranch, mode)` - Merge branches
- `compareBranches(repoPath, base, compare)` - Compare two branches

### `commits.ts`
Commit operations:
- `getCommits(repoPath, branch, skip, limit)` - Get commit history with pagination
- `getCommitFiles(repoPath, hash)` - Get files changed in a commit
- `createCommit(repoPath, message)` - Create new commit
- `resetToCommit(repoPath, hash, mode)` - Reset to specific commit
- `revertCommit(repoPath, hash)` - Revert a commit
- `cherryPickCommit(repoPath, hash)` - Cherry-pick a commit

### `files.ts`
File-level operations:
- `getStatus(repoPath)` - Get working directory status
- `getFileDiff(repoPath, hash, path)` - Get diff for specific file
- `stageFiles(repoPath, paths)` - Stage files for commit
- `unstageFiles(repoPath, paths)` - Unstage files
- `discardChanges(repoPath, paths)` - Discard changes

### `fileTree.ts`
File tree structure:
- `getFileTree(repoPath, commitHash?)` - Build file tree for repository or specific commit

### `graph.ts`
Visualization:
- `getGitGraph(repoPath, branch?)` - Get ASCII graph visualization of commit history

### `remotes.ts`
Remote operations:
- `getRemotes(repoPath)` - List all remotes
- `addRemote(repoPath, name, url)` - Add new remote
- `fetchRemote(repoPath, name)` - Fetch from remote
- `pullRepository(repoPath)` - Pull changes
- `pushRepository(repoPath, options)` - Push changes with force options

### `stash.ts`
Stash management:
- `createStash(repoPath, message?)` - Create new stash
- `getStashList(repoPath)` - List all stashes
- `applyStash(repoPath, index)` - Apply stash
- `popStash(repoPath, index)` - Apply and remove stash
- `dropStash(repoPath, index)` - Delete stash

### `tags.ts`
Tag operations:
- `getTags(repoPath)` - List all tags
- `createLightweightTag(repoPath, name)` - Create lightweight tag
- `createAnnotatedTag(repoPath, name, message)` - Create annotated tag
- `deleteTag(repoPath, name)` - Delete local tag
- `pushTags(repoPath, remote)` - Push tags to remote

### `conflicts.ts`
Conflict resolution:
- `getConflictedFiles(repoPath)` - List files with conflicts
- `getFileConflicts(repoPath, path)` - Parse conflict markers
- `resolveConflict(repoPath, path, strategy)` - Resolve using strategy (ours/theirs/both)
- `abortMerge(repoPath)` - Abort merge operation
- `continueMerge(repoPath)` - Continue after resolving conflicts

### `rebase.ts`
Interactive rebase:
- `getRebasePlan(repoPath, source, target)` - Get commits that will be rebased
- `startInteractiveRebase(repoPath, target, plan)` - Start rebase with custom plan
- `getRebaseStatus(repoPath)` - Check rebase progress
- `continueRebase(repoPath)` - Continue after resolving conflicts
- `abortRebase(repoPath)` - Abort rebase
- `skipRebaseCommit(repoPath)` - Skip current commit

### `search.ts`
Search operations:
- `searchCommits(repoPath, filter, limit)` - Search commits with filters
- `searchCommitsMultiRepo(repoPaths, filter)` - Search across multiple repos
- `getAuthors(repoPath)` - Get unique authors for filtering

### `reflog.ts`
Reflog operations:
- `getReflog(repoPath, ref, maxCount)` - Get reflog entries with parsed actions

### `blame.ts`
Blame information:
- `getFileBlame(repoPath, filePath)` - Get line-by-line blame information

## Design Principles

1. **Single Responsibility**: Each module handles one domain of Git operations
2. **Type Safety**: All types centralized and exported from `types.ts`
3. **Consistent API**: All functions follow similar parameter patterns
4. **Error Handling**: Consistent error handling and logging
5. **Caching**: Integration with `gitCache` for performance
6. **Pure Functions**: Most functions are stateless and side-effect free

## Migration from `gitService.ts`

All functions maintain backward compatibility with the original `gitService.ts` signatures. The refactoring improves:
- Code organization and readability
- Maintainability (smaller, focused files)
- Testability (isolated modules)
- Developer experience (better IDE support)

## Dependencies

- `simple-git` - Git command wrapper
- `gitCache` - Caching layer for performance
- `gitWorkerPool` - Worker pool for heavy operations

## Testing

Each module can be tested independently. Example:

```typescript
import { getBranches } from './git/branches';

describe('branches', () => {
  it('should get branches', async () => {
    const branches = await getBranches('/path/to/repo');
    expect(branches).toBeDefined();
  });
});
```

## Contributing

When adding new Git operations:
1. Determine the appropriate module (or create new one)
2. Add types to `types.ts` if needed
3. Implement function with proper error handling
4. Export from module and `index.ts`
5. Update this README
6. Add tests