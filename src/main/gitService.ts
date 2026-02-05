import simpleGit, { SimpleGit, StatusResult, BranchSummary } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { gitCache } from './cache';
import { gitWorkerPool } from './gitWorker';

export interface RepositoryInfo {
  path: string;
  name: string;
  currentBranch: string;
  branches: string[];
  incomingCommits: number;
  outgoingCommits: number;
  status: {
    modified: string[];
    created: string[];
    deleted: string[];
    renamed: string[];
    conflicted: string[];
    staged: string[];
    ahead: number;
    behind: number;
    current: string | null;
    tracking: string | null;
  };
}

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
  refs: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface BranchInfo {
  name: string;
  commit: string;
  lastCommitDate: string;
  lastCommitMessage: string;
  author: string;
}

export interface CommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
}

export interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

export interface GitGraphRow {
  graph: string;
  hash: string;
  message: string;
}

export interface CommitDetail {
  hash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: string[];
}

export interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  oldPath?: string;
}

export interface ReflogEntry {
  selector: string;
  hash: string;
  refName: string;
  action: string;
  message: string;
  date: string;
  author: string;
}

export interface BlameLine {
  lineNumber: number;
  hash: string;
  author: string;
  date: string;
  content: string;
  summary: string;
}

export interface TagInfo {
  name: string;
  commitHash: string;
  message?: string;
  type: 'lightweight' | 'annotated';
  tagger?: string;
  date?: string;
}

export interface StashEntry {
  index: number;
  hash: string;
  message: string;
  branch: string;
  date: string;
  author: string;
}

export async function getCommitDetails(
  repoPath: string, 
  branch?: string, 
  maxCount: number = 200,
  skip: number = 0
): Promise<CommitDetail[]> {
  // Check cache first
  const cacheKey = { branch, maxCount, skip };
  const cached = gitCache.get<CommitDetail[]>(repoPath, 'commitDetails', cacheKey);
  if (cached) {
    return cached;
  }

  // Use worker pool for heavy operations
  try {
    const commits = await gitWorkerPool.execute<CommitDetail[]>('log', repoPath, {
      branch,
      maxCount,
      skip,
    });

    // Cache the results
    gitCache.set(repoPath, 'commitDetails', commits, cacheKey);
    return commits;
  } catch (error) {
    console.error('Error in getCommitDetails:', error);
    throw error;
  }
}

export async function getGitGraph(repoPath: string, branch?: string): Promise<GitGraphRow[]> {
  const git: SimpleGit = simpleGit(repoPath);

  const normalizedBranch = branch?.startsWith('remotes/') ? branch.replace('remotes/', '') : branch;

  const args = [
    'log',
    '--no-color',
    '--graph',
    '--decorate=short',
    '--oneline',
    '--date-order',
    '--max-count=200',
  ];

  if (normalizedBranch && normalizedBranch.trim().length > 0) {
    args.push(normalizedBranch);
  } else {
    args.push('--all');
  }

  const output = await git.raw(args);
  const lines = output
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  const rows: GitGraphRow[] = [];
  const hashRegex = /[0-9a-f]{7,40}/i;

  for (const line of lines) {
    const match = line.match(hashRegex);
    if (!match || match.index === undefined) continue;

    const hash = match[0];
    const idx = match.index;
    const graph = line.slice(0, idx);
    const message = line.slice(idx + hash.length).trimStart();

    rows.push({ graph, hash, message });
  }

  return rows;
}

export async function pullRepository(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  const branchSummary: BranchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error('Cannot pull: no current branch');
  }

  // Prefer tracking branch if present; otherwise fall back to origin/<branch>
  if (status.tracking) {
    await git.pull(['--ff-only']);
  } else {
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === 'origin');
    if (!hasOrigin) {
      throw new Error('Cannot pull: no tracking branch and no origin remote');
    }
    await git.pull('origin', currentBranch, ['--ff-only']);
  }

  // Invalidate cache after pull
  gitCache.invalidate(repoPath);
}

export interface PushRepositoryOptions {
  force?: boolean;
  forceWithLease?: boolean;
}

export async function pushRepository(repoPath: string, options: PushRepositoryOptions = {}): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  const branchSummary: BranchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error('Cannot push: no current branch');
  }

  const forceFlag = options.forceWithLease
    ? '--force-with-lease'
    : options.force
      ? '--force'
      : null;

  // If upstream exists, push to upstream.
  if (status.tracking) {
    if (forceFlag) {
      await git.raw(['push', forceFlag]);
    } else {
      await git.push();
    }
  } else {
    // No upstream: try to set upstream to origin/<branch>
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === 'origin');
    if (!hasOrigin) {
      throw new Error('Cannot push: no tracking branch and no origin remote');
    }
    if (forceFlag) {
      await git.raw(['push', forceFlag, '-u', 'origin', currentBranch]);
    } else {
      await git.push(['-u', 'origin', currentBranch]);
    }
  }

  // Invalidate cache after push
  gitCache.invalidate(repoPath);
}

export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if there are uncommitted changes
  const status = await git.status();
  if (status.files.length > 0) {
    // Throw structured error with file information
    const error: any = new Error('Cannot checkout: you have uncommitted changes. Please commit or stash them first.');
    error.hasUncommittedChanges = true;
    error.modifiedFiles = status.files.map(f => f.path);
    throw error;
  }

  // Remove 'remotes/' prefix if present
  let targetBranch = branchName;
  if (branchName.startsWith('remotes/')) {
    targetBranch = branchName.replace('remotes/', '');
  }

  // For remote branches like origin/branch-name, create a local tracking branch
  if (targetBranch.includes('/')) {
    const parts = targetBranch.split('/');
    const localBranchName = parts[parts.length - 1];
    
    // Check if local branch already exists
    const branches = await git.branch();
    if (branches.all.includes(localBranchName)) {
      // Local branch exists, just checkout
      await git.checkout(localBranchName);
    } else {
      // Create new local branch tracking the remote
      await git.checkout(['-b', localBranchName, '--track', branchName.startsWith('remotes/') ? branchName.substring(8) : branchName]);
    }
  } else {
    // Local branch, just checkout
    await git.checkout(targetBranch);
  }

  // Invalidate cache after checkout
  gitCache.invalidate(repoPath);
}

// Stash changes and then checkout a branch
export async function stashAndCheckout(repoPath: string, branchName: string, stashMessage?: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if there are uncommitted changes to stash
  const status = await git.status();
  if (status.files.length === 0) {
    // No changes to stash, just checkout
    await checkoutBranch(repoPath, branchName);
    return;
  }

  try {
    // Create stash with a descriptive message
    const message = stashMessage || `Auto-stash before switching to ${branchName}`;
    await createStash(repoPath, message, true);
    
    // Now checkout the branch (this should succeed now)
    // We need to manually do the checkout here to avoid the uncommitted changes check
    let targetBranch = branchName;
    if (branchName.startsWith('remotes/')) {
      targetBranch = branchName.replace('remotes/', '');
    }

    if (targetBranch.includes('/')) {
      const parts = targetBranch.split('/');
      const localBranchName = parts[parts.length - 1];
      
      const branches = await git.branch();
      if (branches.all.includes(localBranchName)) {
        await git.checkout(localBranchName);
      } else {
        await git.checkout(['-b', localBranchName, '--track', branchName.startsWith('remotes/') ? branchName.substring(8) : branchName]);
      }
    } else {
      await git.checkout(targetBranch);
    }

    // Invalidate cache after stash and checkout
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error during stash and checkout:', error);
    throw error;
  }
}

// Discard all changes and then checkout a branch
export async function discardAndCheckout(repoPath: string, branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Reset all changes (staged and unstaged)
    await git.reset(['--hard']);
    
    // Clean untracked files
    await git.clean('f', ['-d']);
    
    // Now checkout the branch
    let targetBranch = branchName;
    if (branchName.startsWith('remotes/')) {
      targetBranch = branchName.replace('remotes/', '');
    }

    if (targetBranch.includes('/')) {
      const parts = targetBranch.split('/');
      const localBranchName = parts[parts.length - 1];
      
      const branches = await git.branch();
      if (branches.all.includes(localBranchName)) {
        await git.checkout(localBranchName);
      } else {
        await git.checkout(['-b', localBranchName, '--track', branchName.startsWith('remotes/') ? branchName.substring(8) : branchName]);
      }
    } else {
      await git.checkout(targetBranch);
    }

    // Invalidate cache after discard and checkout
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error during discard and checkout:', error);
    throw error;
  }
}

export async function mergeBranch(repoPath: string, branchName: string, mergeMode: 'auto' | 'no-ff' | 'ff-only' = 'no-ff'): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if there are uncommitted changes
  const status = await git.status();
  if (status.files.length > 0) {
    throw new Error('Cannot merge: you have uncommitted changes. Please commit or stash them first.');
  }

  const branchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error('Cannot merge: no current branch');
  }

  if (branchName === currentBranch) {
    throw new Error('Cannot merge: branch is already the current branch');
  }

  // Remove 'remotes/' prefix if present for merge command
  let targetBranch = branchName;
  if (branchName.startsWith('remotes/')) {
    targetBranch = branchName.replace('remotes/', '');
  }

  try {
    // Build merge options based on selected mode
    const mergeOptions: string[] = [targetBranch];
    
    if (mergeMode === 'no-ff') {
      // Always create a merge commit (not fast-forward)
      mergeOptions.push('--no-ff', '--no-edit');
    } else if (mergeMode === 'ff-only') {
      // Only allow fast-forward merges
      mergeOptions.push('--ff-only');
    } else {
      // 'auto' mode - use default Git behavior (fast-forward when possible)
      mergeOptions.push('--no-edit');
    }
    
    const result = await git.merge(mergeOptions);
    console.log('Merge result:', result);
    
    // Invalidate cache after successful merge
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    // Invalidate cache even on error (to refresh conflict state)
    gitCache.invalidate(repoPath);
    
    if (error.message && (error.message.includes('CONFLICT') || error.message.includes('Automatic merge failed'))) {
      throw new Error('Merge conflict detected. Please resolve conflicts manually.');
    }
    
    if (error.message && error.message.includes('Not possible to fast-forward')) {
      throw new Error('Cannot fast-forward merge. Use a different merge mode or resolve conflicts manually.');
    }
    
    throw error;
  }
}

export async function createBranch(
  repoPath: string, 
  branchName: string, 
  startPoint?: string, 
  switchAfterCreate: boolean = false, 
  pushAfterCreate: boolean = false
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Validate branch name
  if (!branchName || branchName.trim() === '') {
    throw new Error('Branch name cannot be empty');
  }

  // Check if branch already exists
  const branches = await git.branch();
  if (branches.all.includes(branchName)) {
    throw new Error(`Branch "${branchName}" already exists`);
  }

  // Create branch from start point (commit hash or branch name) or from HEAD
  if (startPoint) {
    await git.branch([branchName, startPoint]);
  } else {
    await git.branch([branchName]);
  }

  // Switch to new branch if requested
  if (switchAfterCreate) {
    await git.checkout(branchName);
  }

  // Push new branch to remote if requested
  if (pushAfterCreate) {
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === 'origin');
    if (hasOrigin) {
      // If we switched to the branch, just push it with upstream
      if (switchAfterCreate) {
        await git.push(['-u', 'origin', branchName]);
      } else {
        // If we didn't switch, push the branch without switching
        await git.push(['origin', branchName]);
      }
    } else {
      throw new Error('Cannot push: no origin remote configured');
    }
  }

  // Invalidate cache after creating branch
  gitCache.invalidate(repoPath);
}

export async function deleteBranch(repoPath: string, branchName: string, force: boolean = false): Promise<{ deleted: boolean; warning?: string }> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if it's the current branch
  const branchSummary = await git.branch();
  if (branchSummary.current === branchName) {
    throw new Error('Cannot delete the currently checked out branch');
  }

  // Check if branch is merged (unless force is true)
  if (!force) {
    try {
      // Get list of merged branches
      const mergedBranches = await git.raw(['branch', '--merged']);
      const isMerged = mergedBranches.split('\n').some(line => line.trim() === branchName || line.trim() === `* ${branchName}`);
      
      if (!isMerged) {
        return {
          deleted: false,
          warning: 'Branch is not fully merged. Use force delete to remove it anyway.'
        };
      }
    } catch (error) {
      console.error('Error checking if branch is merged:', error);
    }
  }

  // Delete the branch
  try {
    await git.branch([force ? '-D' : '-d', branchName]);
    gitCache.invalidate(repoPath);
    return { deleted: true };
  } catch (error: any) {
    throw new Error(`Failed to delete branch: ${error.message}`);
  }
}

export async function deleteRemoteBranch(repoPath: string, remoteName: string, branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Delete the remote branch
  try {
    await git.push([remoteName, '--delete', branchName]);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    throw new Error(`Failed to delete remote branch: ${error.message}`);
  }
}

export async function renameBranch(repoPath: string, oldName: string, newName: string, renameRemote: boolean = false): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Validate new branch name
  if (!newName || newName.trim() === '') {
    throw new Error('New branch name cannot be empty');
  }

  // Check if new branch name already exists
  const branches = await git.branch();
  if (branches.all.includes(newName)) {
    throw new Error(`Branch "${newName}" already exists`);
  }

  // Check if we're renaming the current branch
  const isCurrentBranch = branches.current === oldName;

  // Rename the local branch
  if (isCurrentBranch) {
    await git.branch(['-m', newName]);
  } else {
    await git.branch(['-m', oldName, newName]);
  }

  // If renaming remote branch as well
  if (renameRemote) {
    try {
      // Get the remote tracking branch
      const trackingInfo = await git.raw(['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${oldName}@{u}`]);
      if (trackingInfo && trackingInfo.trim()) {
        const [remoteName, remoteBranch] = trackingInfo.trim().split('/');
        
        // Delete old remote branch and push new one
        await git.push([remoteName, '--delete', remoteBranch]);
        await git.push(['-u', remoteName, newName]);
      }
    } catch (error) {
      // Remote branch might not exist, just continue
      console.warn('Remote branch does not exist or could not be renamed:', error);
    }
  }

  gitCache.invalidate(repoPath);
}

export async function setUpstreamBranch(repoPath: string, localBranch: string, remoteName: string, remoteBranch: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.branch(['--set-upstream-to', `${remoteName}/${remoteBranch}`, localBranch]);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    throw new Error(`Failed to set upstream branch: ${error.message}`);
  }
}

export async function unsetUpstreamBranch(repoPath: string, branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.branch(['--unset-upstream', branchName]);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    throw new Error(`Failed to unset upstream branch: ${error.message}`);
  }
}

export async function compareBranches(repoPath: string, baseBranch: string, compareBranch: string): Promise<{
  ahead: number;
  behind: number;
  files: { path: string; status: string; additions: number; deletions: number }[];
}> {
  const git: SimpleGit = simpleGit(repoPath);

  // Get commits ahead/behind
  const revList = await git.raw(['rev-list', '--left-right', '--count', `${baseBranch}...${compareBranch}`]);
  const [behind, ahead] = revList.trim().split('\t').map(Number);

  // Get file differences
  const diffSummary = await git.diffSummary([baseBranch, compareBranch]);
  
  const files = diffSummary.files.map(file => ({
    path: file.file,
    status: file.binary ? 'binary' : 'modified',
    additions: 'insertions' in file ? file.insertions : 0,
    deletions: 'deletions' in file ? file.deletions : 0
  }));

  return { ahead, behind, files };
}

// Scan folder for all git repositories
export async function scanForRepositories(folderPath: string): Promise<string[]> {
  const repositories: string[] = [];

  async function scan(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      // Check if current directory is a git repository
      if (entries.some(entry => entry.name === '.git' && entry.isDirectory())) {
        repositories.push(dir);
        return; // Don't scan subdirectories of a git repo
      }

      // Scan subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const fullPath = path.join(dir, entry.name);
          await scan(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }

  await scan(folderPath);
  return repositories;
}

// Get detailed repository information
export async function getRepositoryInfo(repoPath: string, forceFetch: boolean = false): Promise<RepositoryInfo> {
  // repoInfo changes frequently locally (status/outgoing), but remote state changes only after fetch.
  // Keep cached entry mainly to throttle fetches; still recompute local parts every call.
  const cached = gitCache.get<RepositoryInfo>(repoPath, 'repoInfo');

  const git: SimpleGit = simpleGit(repoPath);

  try {
    const shouldFetch = forceFetch || !cached;
    if (shouldFetch) {
      try {
        await git.fetch();
      } catch (error) {
        // Fetch may fail for offline/private remotes; still allow local status to update.
        console.warn('Fetch failed in getRepositoryInfo (continuing with local info):', error);
      }
    }

    // Get current branch
    const branchSummary: BranchSummary = await git.branch();
    const currentBranch = branchSummary.current;

    // Get all branches
    const branches = Object.keys(branchSummary.branches);

    // Get status
    const status: StatusResult = await git.status();

    // Calculate incoming and outgoing commits
    let incomingCommits = 0;
    let outgoingCommits = 0;

    try {
      if (currentBranch) {
        const upstream = status.tracking || `origin/${currentBranch}`;
        const revList = await git.raw([
          'rev-list',
          '--left-right',
          '--count',
          `${currentBranch}...${upstream}`,
        ]);
        const [outgoing, incoming] = revList.trim().split('\t').map(Number);
        outgoingCommits = outgoing || 0;
        incomingCommits = incoming || 0;
      }
    } catch (error) {
      console.log('No remote tracking branch found');
    }

    const repoInfo: RepositoryInfo = {
      path: repoPath,
      name: path.basename(repoPath),
      currentBranch,
      branches,
      incomingCommits,
      outgoingCommits,
      status: {
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: status.renamed.map(r => typeof r === 'string' ? r : r.to),
        conflicted: status.conflicted,
        staged: status.staged,
        ahead: status.ahead,
        behind: status.behind,
        current: status.current,
        tracking: status.tracking,
      },
    };

    // Cache to throttle remote fetches; local fields are recomputed each call.
    gitCache.set(repoPath, 'repoInfo', repoInfo);

    return repoInfo;
  } catch (error) {
    console.error('Error getting repository info:', error);
    throw error;
  }
}

// Get unpushed commits (ahead of remote)
export async function getUnpushedCommits(repoPath: string): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get current branch
    const status: StatusResult = await git.status();
    const currentBranch = status.current;
    
    if (!currentBranch) {
      return [];
    }

    const upstream = status.tracking;
    
    // If no tracking branch, return empty
    if (!upstream) {
      return [];
    }

    // Get commits ahead of upstream
    const log = await git.log({
      from: upstream,
      to: currentBranch,
    });

    const commits = log.all.map(commit => ({
      hash: commit.hash,
      date: commit.date,
      message: commit.message,
      author: commit.author_name,
      refs: commit.refs,
    }));

    return commits;
  } catch (error) {
    console.error('Error getting unpushed commits:', error);
    return [];
  }
}

// Get commit history
export async function getCommits(repoPath: string, branch?: string, skip: number = 0, limit: number = 25): Promise<CommitInfo[]> {
  // Check cache first
  const cacheKey = { branch, skip, limit };
  const cached = gitCache.get<CommitInfo[]>(repoPath, 'commits', cacheKey);
  if (cached) {
    return cached;
  }

  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Use skip parameter for pagination
    const logOptions: any = {
      maxCount: limit,
    };
    
    if (skip > 0) {
      logOptions['--skip'] = skip.toString();
    }
    
    if (branch) {
      logOptions.from = branch;
    }
    
    const log = await git.log(logOptions);

    const commits = log.all.map(commit => ({
      hash: commit.hash,
      date: commit.date,
      message: commit.message,
      author: commit.author_name,
      refs: commit.refs,
    }));

    // Cache the results
    gitCache.set(repoPath, 'commits', commits, cacheKey);

    return commits;
  } catch (error) {
    console.error('Error getting commits:', error);
    throw error;
  }
}

// Get file tree for repository
export async function getFileTree(repoPath: string, commitHash?: string): Promise<FileTreeNode> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Check cache first - use different cache keys for working tree vs specific commits
    const cacheKey = commitHash ? `fileTree-${commitHash}` : 'fileTree';
    const cached = gitCache.get<FileTreeNode>(repoPath, cacheKey);
    if (cached) {
      console.log('✓ Returning cached file tree (instant load)');
      return cached;
    }

    console.log('⟳ Building file tree...');
    const startTime = Date.now();
    let tree: FileTreeNode;
    
    // If no commit hash provided, get current working tree
    if (!commitHash) {
      tree = await buildFileTree(repoPath);
    } else {
      // Get file list for specific commit
      const files = await git.raw(['ls-tree', '-r', '--name-only', commitHash]);
      const fileList = files.trim().split('\n').filter(f => f);
      tree = buildTreeFromPaths(fileList, repoPath);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✓ File tree built in ${elapsed}ms`);

    // Cache the result with longer TTL for file tree
    gitCache.set(repoPath, cacheKey, tree);
    
    return tree;
  } catch (error) {
    console.error('Error getting file tree:', error);
    throw error;
  }
}

// Build file tree from file system with parallel loading
async function buildFileTree(dirPath: string, relativePath: string = ''): Promise<FileTreeNode> {
  const name = relativePath ? path.basename(dirPath) : path.basename(dirPath);
  const node: FileTreeNode = {
    name,
    path: relativePath || '/',
    type: 'directory',
    children: [],
  };

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Separate files and directories
    const files: FileTreeNode[] = [];
    const directories: Promise<FileTreeNode>[] = [];

    for (const entry of entries) {
      // Skip .git directory
      if (entry.name === '.git') continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        // Add directory to parallel processing queue
        directories.push(buildFileTree(fullPath, relPath));
      } else {
        // Add file immediately
        files.push({
          name: entry.name,
          path: relPath,
          type: 'file',
        });
      }
    }

    // Process all directories in parallel
    const directoryNodes = await Promise.all(directories);
    
    // Combine files and directories
    node.children = [...directoryNodes, ...files];

    // Sort: directories first, then files
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error building file tree:', error);
  }

  return node;
}

// Build tree structure from flat file paths
function buildTreeFromPaths(paths: string[], rootPath: string): FileTreeNode {
  const root: FileTreeNode = {
    name: path.basename(rootPath),
    path: '/',
    type: 'directory',
    children: [],
  };

  for (const filePath of paths) {
    const parts = filePath.split('/').filter(p => p);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      let child = current.children!.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        };
        current.children!.push(child);
      }

      if (!isFile) {
        current = child;
      }
    }
  }

  return root;
}

// Get detailed branch information
export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  // Check cache first
  const cached = gitCache.get<BranchInfo[]>(repoPath, 'branches');
  if (cached) {
    return cached;
  }

  try {
    // Get all branches including remotes
    const branchSummary: BranchSummary = await git.branch(['-a', '-v']);
    
    // Get all commits for branches in one batch query using git log with --all
    // This is much faster than individual git.log() calls per branch
    const logResult = await git.raw(
      'log',
      '--all',
      '--branches',
      '--remotes',
      '--format=%H|%ai|%an|%s',
      '-n', '1000' // Get last 1000 commits to cover all branches
    );
    
    // Parse the log output into a map: commit hash -> commit info
    const commitMap = new Map<string, { date: string; author: string; message: string }>();
    const logLines = logResult.trim().split('\n').filter(line => line);
    
    for (const line of logLines) {
      const [hash, date, author, ...messageParts] = line.split('|');
      if (hash) {
        commitMap.set(hash, {
          date: date || '',
          author: author || '',
          message: messageParts.join('|') || ''
        });
      }
    }
    
    // Build branches array using pre-fetched commit data
    const branches: BranchInfo[] = [];
    
    for (const [branchName, branchData] of Object.entries(branchSummary.branches)) {
      const commitInfo = commitMap.get(branchData.commit);
      
      branches.push({
        name: branchName,
        commit: branchData.commit,
        lastCommitDate: commitInfo?.date || '',
        lastCommitMessage: commitInfo?.message || '',
        author: commitInfo?.author || '',
      });
    }
    
    // Cache the result
    gitCache.set(repoPath, 'branches', branches);

    return branches;
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
}

// Get files changed in a specific commit
export async function getCommitFiles(repoPath: string, commitHash: string): Promise<CommitFile[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Check if the commit exists and has a parent
    let diffSummary;
    try {
      // Try to get the diff with parent commit
      diffSummary = await git.diffSummary([`${commitHash}^`, commitHash]);
    } catch (error) {
      // If that fails, it might be the initial commit or the commit doesn't exist
      // Try using --root flag for initial commits
      try {
        diffSummary = await git.diffSummary(['--root', commitHash]);
      } catch (rootError) {
        // If both fail, try comparing against empty tree (works for any commit without parent)
        diffSummary = await git.diffSummary(['4b825dc642cb6eb9a060e54bf8d69288fbee4904', commitHash]);
      }
    }
    
    const files: CommitFile[] = diffSummary.files.map(file => {
      let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
      
      // Get insertions and deletions safely
      const insertions = 'insertions' in file ? file.insertions : 0;
      const deletions = 'deletions' in file ? file.deletions : 0;
      
      if (file.binary) {
        status = 'modified';
      } else if (file.file.includes('=>')) {
        status = 'renamed';
      } else {
        // Check if file was added or deleted
        if (insertions > 0 && deletions === 0) {
          status = 'added';
        } else if (insertions === 0 && deletions > 0) {
          status = 'deleted';
        }
      }

      return {
        path: file.file,
        status,
        additions: insertions,
        deletions: deletions,
      };
    });

    return files;
  } catch (error) {
    console.error('Error getting commit files:', error);
    throw error;
  }
}

// Get diff for a specific file in a commit with incremental loading support
export async function getFileDiff(
  repoPath: string, 
  commitHash: string, 
  filePath: string,
  maxLines?: number
): Promise<FileDiff> {
  // Check cache first
  const cacheKey = { commitHash, filePath, maxLines };
  const cached = gitCache.get<FileDiff>(repoPath, 'fileDiff', cacheKey);
  if (cached) {
    return cached;
  }

  // Use worker pool for potentially large diffs
  try {
    const diff = await gitWorkerPool.execute<string>('diff', repoPath, {
      filePath,
      commitHash,
      maxLines,
    });
    
    // Count additions and deletions
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    const result: FileDiff = {
      path: filePath,
      diff,
      additions,
      deletions,
    };

    // Cache the result
    gitCache.set(repoPath, 'fileDiff', result, cacheKey);

    return result;
  } catch (error) {
    console.error('Error getting file diff:', error);
    throw error;
  }
}

// Get status of working directory and staging area
export async function getStatus(repoPath: string): Promise<FileStatus[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const status: StatusResult = await git.status();
    const files: FileStatus[] = [];

    // Staged files
    for (const file of status.staged) {
      files.push({
        path: file,
        status: 'added',
        staged: true,
      });
    }

    // Modified files (not staged)
    for (const file of status.modified) {
      if (!status.staged.includes(file)) {
        files.push({
          path: file,
          status: 'modified',
          staged: false,
        });
      }
    }

    // Created files (untracked)
    for (const file of status.not_added) {
      files.push({
        path: file,
        status: 'untracked',
        staged: false,
      });
    }

    // Deleted files
    for (const file of status.deleted) {
      files.push({
        path: file,
        status: 'deleted',
        staged: status.staged.includes(file),
      });
    }

    // Renamed files
    for (const rename of status.renamed) {
      const fileData = typeof rename === 'string' 
        ? { from: rename, to: rename } 
        : rename;
      
      files.push({
        path: fileData.to,
        status: 'renamed',
        staged: true,
        oldPath: fileData.from,
      });
    }

    return files;
  } catch (error) {
    console.error('Error getting status:', error);
    throw error;
  }
}

// Stage files
export async function stageFiles(repoPath: string, filePaths: string[]): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.add(filePaths);
  } catch (error) {
    console.error('Error staging files:', error);
    throw error;
  }
}

// Unstage files
export async function unstageFiles(repoPath: string, filePaths: string[]): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.reset(['HEAD', '--', ...filePaths]);
  } catch (error) {
    console.error('Error unstaging files:', error);
    throw error;
  }
}

// Discard changes in files
export async function discardChanges(repoPath: string, filePaths: string[]): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // For each file, check if it's untracked or modified
    const status = await git.status();
    
    for (const filePath of filePaths) {
      // Check if file is untracked (new file)
      if (status.not_added.includes(filePath)) {
        // Delete untracked file
        const fullPath = path.join(repoPath, filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } else {
        // For tracked files (modified, deleted, etc.), restore from HEAD
        await git.checkout(['HEAD', '--', filePath]);
      }
    }
    
    // Invalidate cache after discarding changes
    gitCache.invalidate(repoPath, 'status');
  } catch (error) {
    console.error('Error discarding changes:', error);
    throw error;
  }
}

// Create commit
export async function createCommit(repoPath: string, message: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.commit(message);
    // Commit changes affect many views (history/graph/repo summary/diffs).
    // Clear repo cache to keep sidebar + commits panel in sync.
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error creating commit:', error);
    throw error;
  }
}

// Get diff for a working directory file
export async function getWorkingFileDiff(repoPath: string, filePath: string, staged: boolean): Promise<FileDiff> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get the diff for the specific file
    // If staged, compare staged version with HEAD
    // If unstaged, compare working directory with staged (or HEAD if not staged)
    const args = staged ? ['--cached', '--', filePath] : ['--', filePath];
    const diff = await git.diff(args);
    
    // Count additions and deletions
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      path: filePath,
      diff,
      additions,
      deletions,
    };
  } catch (error) {
    console.error('Error getting working file diff:', error);
    throw error;
  }
}

// Get reflog entries
export async function getReflog(repoPath: string, ref: string = 'HEAD', maxCount: number = 100): Promise<ReflogEntry[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Format: %gD|%H|%gn|%gs|%ci|%cn
    // %gD - reflog selector (HEAD@{0})
    // %H - commit hash
    // %gn - reflog ref name
    // %gs - reflog subject (action message)
    // %ci - committer date ISO
    // %cn - committer name
    const args = [
      'reflog',
      ref,
      `--max-count=${maxCount}`,
      '--format=%gD|%H|%gn|%gs|%ci|%cn',
      '--date=iso',
    ];

    const output = await git.raw(args);
    const lines = output
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const entries: ReflogEntry[] = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 6) continue;

      const [selector, hash, refName, subject, date, author] = parts;
      
      // Parse action from subject with enhanced detection
      let action = 'unknown';
      const subjectLower = subject.toLowerCase();
      
      // Check for specific patterns - order matters (most specific first)
      if (subjectLower.match(/^merge\b/i) || subjectLower.match(/merge.*into/i) || subjectLower.includes('merge branch')) {
        action = 'merge';
      } else if (subjectLower.match(/pull.*into/i) || subjectLower.includes('pull origin') || subjectLower.includes('fast-forward')) {
        action = 'pull';
      } else if (subjectLower.match(/^rebase/i) || subjectLower.includes('rebase -i') || subjectLower.includes('rebase (start)') || subjectLower.includes('rebase (finish)') || subjectLower.includes('rebase (continue)')) {
        action = 'rebase';
      } else if (subjectLower.match(/commit \(amend\)/i) || subjectLower.includes('amend')) {
        action = 'amend';
      } else if (subjectLower.match(/^commit:/i) || subjectLower.match(/^commit \(/i) || subjectLower.match(/^commit\b/i)) {
        action = 'commit';
      } else if (subjectLower.match(/^checkout:/i) || subjectLower.includes('moving from') || subjectLower.match(/checkout.*to/i)) {
        action = 'checkout';
      } else if (subjectLower.match(/^reset:/i) || subjectLower.includes('reset --') || subjectLower.match(/moving to \w{7,}/i)) {
        action = 'reset';
      } else if (subjectLower.match(/^clone/i) || subjectLower.includes('from remote')) {
        action = 'clone';
      } else if (subjectLower.match(/^fetch/i) || subjectLower.includes('fetch origin')) {
        action = 'fetch';
      } else if (subjectLower.match(/cherry.?pick/i) || subjectLower.includes('pick')) {
        action = 'cherry-pick';
      } else if (subjectLower.match(/^push/i) || subjectLower.includes('update by push')) {
        action = 'push';
      } else if (subjectLower.match(/^branch:/i) || subjectLower.includes('created') || subjectLower.includes('branch: created')) {
        action = 'branch';
      } else if (subjectLower.match(/^stash/i)) {
        action = 'stash';
      } else if (subjectLower.match(/^initial commit/i)) {
        action = 'initial';
      } else {
        // Fall back to extracting first word before colon
        const actionMatch = subject.match(/^(\w+):/);
        if (actionMatch) {
          action = actionMatch[1];
        }
      }
      
      entries.push({
        selector,
        hash,
        refName: refName || ref,
        action,
        message: subject,
        date,
        author,
      });
    }

    return entries;
  } catch (error) {
    console.error('Error getting reflog:', error);
    throw error;
  }
}

// Reset to a specific commit
export async function resetToCommit(repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.reset([`--${mode}`, commitHash]);
    // Invalidate file tree cache after reset
    gitCache.invalidate(repoPath, 'fileTree');
  } catch (error) {
    console.error('Error resetting to commit:', error);
    throw error;
  }
}

// Cherry-pick a commit
export async function cherryPickCommit(repoPath: string, commitHash: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(['cherry-pick', commitHash]);
    // Invalidate file tree cache after cherry-pick
    gitCache.invalidate(repoPath, 'fileTree');
  } catch (error) {
    console.error('Error cherry-picking commit:', error);
    throw error;
  }
}

// Revert a commit (creates a new commit)
export async function revertCommit(repoPath: string, commitHash: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Ensure the object exists; gives clearer errors for invalid hashes
    await git.revparse([commitHash]);

    // Use default revert message without opening an editor
    await git.raw(['revert', '--no-edit', commitHash]);

    // Invalidate caches after creating a new commit
    gitCache.invalidate(repoPath, 'fileTree');
    gitCache.invalidate(repoPath, 'repositoryInfo');
    gitCache.invalidate(repoPath, 'branches');
  } catch (error) {
    console.error('Error reverting commit:', error);
    throw error;
  }
}

export type AbortRevertResult = 'aborted' | 'noop';

export async function abortRevert(repoPath: string): Promise<AbortRevertResult> {
  const git: SimpleGit = simpleGit(repoPath);
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Check if a revert/cherry-pick is actually in progress by checking multiple indicators:
    // 1. REVERT_HEAD or CHERRY_PICK_HEAD files
    // 2. .git/sequencer directory
    const isRevertInProgress = await (async () => {
      try {
        const gitDir = path.join(repoPath, '.git');
        
        // Check for REVERT_HEAD
        try {
          await fs.access(path.join(gitDir, 'REVERT_HEAD'));
          return true;
        } catch {}
        
        // Check for CHERRY_PICK_HEAD (git revert uses cherry-pick internally)
        try {
          await fs.access(path.join(gitDir, 'CHERRY_PICK_HEAD'));
          return true;
        } catch {}
        
        // Check for sequencer directory (indicates ongoing operation)
        try {
          await fs.access(path.join(gitDir, 'sequencer'));
          return true;
        } catch {}
        
        return false;
      } catch {
        return false;
      }
    })();

    if (!isRevertInProgress) {
      return 'noop';
    }

    await git.raw(['revert', '--abort']);
    gitCache.invalidate(repoPath, 'fileTree');
    gitCache.invalidate(repoPath, 'repositoryInfo');
    gitCache.invalidate(repoPath, 'branches');

    return 'aborted';
  } catch (error) {
    console.error('Error aborting revert:', error);
    throw error;
  }
}

export type ContinueRevertResult = 'continued' | 'noop';

export async function continueRevert(repoPath: string): Promise<ContinueRevertResult> {
  const git: SimpleGit = simpleGit(repoPath);
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Check if a revert/cherry-pick is actually in progress by checking multiple indicators:
    // 1. REVERT_HEAD or CHERRY_PICK_HEAD files
    // 2. .git/sequencer directory
    const isRevertInProgress = await (async () => {
      try {
        const gitDir = path.join(repoPath, '.git');
        
        // Check for REVERT_HEAD
        try {
          await fs.access(path.join(gitDir, 'REVERT_HEAD'));
          return true;
        } catch {}
        
        // Check for CHERRY_PICK_HEAD (git revert uses cherry-pick internally)
        try {
          await fs.access(path.join(gitDir, 'CHERRY_PICK_HEAD'));
          return true;
        } catch {}
        
        // Check for sequencer directory (indicates ongoing operation)
        try {
          await fs.access(path.join(gitDir, 'sequencer'));
          return true;
        } catch {}
        
        return false;
      } catch {
        return false;
      }
    })();

    if (!isRevertInProgress) {
      return 'noop';
    }

    // If we are in a revert, ensure conflicts are fully resolved before continuing.
    const conflictedFiles = await getConflictedFiles(repoPath);
    if (conflictedFiles.length > 0) {
      throw new Error(`Cannot continue revert: ${conflictedFiles.length} file(s) still have conflicts`);
    }

    await git.raw(['revert', '--continue']);
    gitCache.invalidate(repoPath, 'fileTree');
    gitCache.invalidate(repoPath, 'repositoryInfo');
    gitCache.invalidate(repoPath, 'branches');

    return 'continued';
  } catch (error) {
    console.error('Error continuing revert:', error);
    throw error;
  }
}

// ==================== STASH MANAGEMENT ====================

// Create a stash with optional message
export async function createStash(repoPath: string, message?: string, includeUntracked: boolean = false): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const args = ['stash', 'push'];
    
    if (includeUntracked) {
      args.push('-u');
    }
    
    if (message) {
      args.push('-m', message);
    }
    
    await git.raw(args);
  } catch (error) {
    console.error('Error creating stash:', error);
    throw error;
  }
}

// Get list of all stashes
export async function getStashList(repoPath: string): Promise<StashEntry[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Format: %gD|%H|%gs|%gd|%ci|%cn
    // %gD - reflog selector (stash@{0})
    // %H - commit hash
    // %gs - reflog subject (message)
    // %gd - reflog ref name
    // %ci - committer date ISO
    // %cn - committer name
    const output = await git.raw([
      'stash',
      'list',
      '--format=%gD|%H|%gs|%gd|%ci|%cn',
    ]);
    
    if (!output || output.trim().length === 0) {
      return [];
    }
    
    const lines = output
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    const stashes: StashEntry[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('|');
      if (parts.length < 6) continue;
      
      const [selector, hash, subject, _refName, date, author] = parts;
      
      // Extract branch name from subject like "WIP on main: abc1234 commit message"
      // or "On main: abc1234 commit message"
      let branch = 'unknown';
      let message = subject;
      
      const wipMatch = subject.match(/^(?:WIP on|On) ([^:]+):/);
      if (wipMatch) {
        branch = wipMatch[1];
        // Extract the actual message after the branch
        const messageMatch = subject.match(/^(?:WIP on|On) [^:]+: (.+)$/);
        if (messageMatch) {
          message = messageMatch[1];
        }
      }
      
      stashes.push({
        index: i,
        hash,
        message,
        branch,
        date,
        author,
      });
    }
    
    return stashes;
  } catch (error) {
    console.error('Error getting stash list:', error);
    throw error;
  }
}

// Apply a stash by index (keeps the stash in the list)
export async function applyStash(repoPath: string, index: number): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.raw(['stash', 'apply', `stash@{${index}}`]);
    // Invalidate cache after applying stash
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error applying stash:', error);
    throw error;
  }
}

// Pop a stash by index (removes the stash from the list)
export async function popStash(repoPath: string, index: number): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.raw(['stash', 'pop', `stash@{${index}}`]);
    // Invalidate cache after popping stash
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error popping stash:', error);
    throw error;
  }
}

// Drop (delete) a stash by index
export async function dropStash(repoPath: string, index: number): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.raw(['stash', 'drop', `stash@{${index}}`]);
  } catch (error) {
    console.error('Error dropping stash:', error);
    throw error;
  }
}

// Get diff of a stash
export async function getStashDiff(repoPath: string, index: number): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const diff = await git.raw(['stash', 'show', '-p', `stash@{${index}}`]);
    return diff;
  } catch (error) {
    console.error('Error getting stash diff:', error);
    throw error;
  }
}

// Get stash files (list of changed files in a stash)
export async function getStashFiles(repoPath: string, index: number): Promise<CommitFile[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Get numstat for the stash
    const output = await git.raw([
      'stash',
      'show',
      '--numstat',
      `stash@{${index}}`,
    ]);
    
    if (!output || output.trim().length === 0) {
      return [];
    }
    
    const lines = output
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    const files: CommitFile[] = [];
    
    for (const line of lines) {
      // Format: additions deletions filename
      // or: - - filename (for binary files)
      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;
      
      const [addStr, delStr, ...pathParts] = parts;
      const filePath = pathParts.join(' ');
      
      const additions = addStr === '-' ? 0 : parseInt(addStr, 10);
      const deletions = delStr === '-' ? 0 : parseInt(delStr, 10);
      
      // Determine status
      let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
      if (additions > 0 && deletions === 0) {
        status = 'added';
      } else if (additions === 0 && deletions > 0) {
        status = 'deleted';
      }
      
      files.push({
        path: filePath,
        status,
        additions,
        deletions,
      });
    }
    
    return files;
  } catch (error) {
    console.error('Error getting stash files:', error);
    throw error;
  }
}

// Create a new branch from a stash
export async function createBranchFromStash(
  repoPath: string,
  index: number,
  branchName: string
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // This will create a branch and apply the stash, then drop the stash
    await git.raw(['stash', 'branch', branchName, `stash@{${index}}`]);
  } catch (error) {
    console.error('Error creating branch from stash:', error);
    throw error;
  }
}

// Clear all stashes
export async function clearAllStashes(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.raw(['stash', 'clear']);
  } catch (error) {
    console.error('Error clearing stashes:', error);
    throw error;
  }
}

// ============================================================================
// Conflict Resolution Functions
// ============================================================================

export interface ConflictMarker {
  startLine: number;
  endLine: number;
  currentContent: string;
  incomingContent: string;
  baseContent?: string;
}

export interface ConflictFile {
  path: string;
  conflicts: ConflictMarker[];
  content: string;
}

// Get list of conflicted files
export async function getConflictedFiles(repoPath: string): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const status = await git.status();
    return status.conflicted || [];
  } catch (error) {
    console.error('Error getting conflicted files:', error);
    throw error;
  }
}

// Parse conflict markers in a file
export async function getFileConflicts(repoPath: string, filePath: string): Promise<ConflictFile> {
  try {
    const fullPath = path.join(repoPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    const conflicts: ConflictMarker[] = [];
    let i = 0;
    
    while (i < lines.length) {
      // Look for conflict start marker
      if (lines[i].startsWith('<<<<<<<')) {
        const startLine = i;
        const currentLines: string[] = [];
        const incomingLines: string[] = [];
        const baseLines: string[] = [];
        let hasBase = false;
        
        // Collect current (HEAD) content
        i++;
        while (i < lines.length && !lines[i].startsWith('|||||||') && !lines[i].startsWith('=======')) {
          currentLines.push(lines[i]);
          i++;
        }
        
        // Check for base content (diff3 style)
        if (lines[i]?.startsWith('|||||||')) {
          hasBase = true;
          i++;
          while (i < lines.length && !lines[i].startsWith('=======')) {
            baseLines.push(lines[i]);
            i++;
          }
        }
        
        // Skip separator
        if (lines[i]?.startsWith('=======')) {
          i++;
        }
        
        // Collect incoming content
        while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
          incomingLines.push(lines[i]);
          i++;
        }
        
        const endLine = i;
        
        conflicts.push({
          startLine,
          endLine,
          currentContent: currentLines.join('\n'),
          incomingContent: incomingLines.join('\n'),
          baseContent: hasBase ? baseLines.join('\n') : undefined,
        });
      }
      i++;
    }
    
    return {
      path: filePath,
      conflicts,
      content,
    };
  } catch (error) {
    console.error('Error getting file conflicts:', error);
    throw error;
  }
}

// Resolve a conflict by choosing a resolution strategy
export async function resolveConflict(
  repoPath: string,
  filePath: string,
  resolution: 'ours' | 'theirs' | 'both',
  conflictIndex?: number
): Promise<void> {
  try {
    const conflictFile = await getFileConflicts(repoPath, filePath);
    const lines = conflictFile.content.split('\n');
    const newLines: string[] = [];
    
    // Determine which conflicts to resolve
    const conflictsToResolve = conflictIndex !== undefined 
      ? [conflictFile.conflicts[conflictIndex]]
      : conflictFile.conflicts;
    
    let currentLineIndex = 0;
    let processedConflicts = 0;
    
    for (const conflict of conflictFile.conflicts) {
      // Add lines before conflict
      while (currentLineIndex < conflict.startLine) {
        newLines.push(lines[currentLineIndex]);
        currentLineIndex++;
      }
      
      // Check if this conflict should be resolved
      const shouldResolve = conflictIndex === undefined || processedConflicts === conflictIndex;
      
      if (shouldResolve) {
        // Add resolved content based on strategy
        switch (resolution) {
          case 'ours':
            newLines.push(conflict.currentContent);
            break;
          case 'theirs':
            newLines.push(conflict.incomingContent);
            break;
          case 'both':
            newLines.push(conflict.currentContent);
            newLines.push(conflict.incomingContent);
            break;
        }
        
        // Skip to end of conflict
        currentLineIndex = conflict.endLine + 1;
      } else {
        // Keep conflict markers as-is
        while (currentLineIndex <= conflict.endLine) {
          newLines.push(lines[currentLineIndex]);
          currentLineIndex++;
        }
      }
      
      processedConflicts++;
    }
    
    // Add remaining lines
    while (currentLineIndex < lines.length) {
      newLines.push(lines[currentLineIndex]);
      currentLineIndex++;
    }
    
    // Write resolved content
    const fullPath = path.join(repoPath, filePath);
    fs.writeFileSync(fullPath, newLines.join('\n'), 'utf-8');
    
    // If all conflicts resolved, stage the file
    const remainingConflicts = await getFileConflicts(repoPath, filePath);
    if (remainingConflicts.conflicts.length === 0) {
      const git: SimpleGit = simpleGit(repoPath);
      await git.add(filePath);
    }
  } catch (error) {
    console.error('Error resolving conflict:', error);
    throw error;
  }
}

// Manually resolve conflict with custom content
export async function resolveConflictManual(
  repoPath: string,
  filePath: string,
  content: string
): Promise<void> {
  try {
    const fullPath = path.join(repoPath, filePath);
    fs.writeFileSync(fullPath, content, 'utf-8');
    
    // Stage the resolved file
    const git: SimpleGit = simpleGit(repoPath);
    await git.add(filePath);
  } catch (error) {
    console.error('Error manually resolving conflict:', error);
    throw error;
  }
}

// Launch external merge tool
export async function launchMergeTool(repoPath: string, filePath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Launch merge tool for the specific file
    await git.raw(['mergetool', '--no-prompt', filePath]);
  } catch (error) {
    console.error('Error launching merge tool:', error);
    throw error;
  }
}

// Abort ongoing merge
export async function abortMerge(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.raw(['merge', '--abort']);
  } catch (error) {
    console.error('Error aborting merge:', error);
    throw error;
  }
}

// Continue merge after resolving conflicts
export async function continueMerge(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check if there are still unresolved conflicts
    const conflictedFiles = await getConflictedFiles(repoPath);
    if (conflictedFiles.length > 0) {
      throw new Error(`Cannot continue merge: ${conflictedFiles.length} file(s) still have conflicts`);
    }
    
    // Continue with merge commit
    await git.raw(['commit', '--no-edit']);
  } catch (error) {
    console.error('Error continuing merge:', error);
    throw error;
  }
}

// ========== Search & Filter Functions ==========

export interface SearchFilter {
  query?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
}

export interface SearchResult {
  hash: string;
  date: string;
  message: string;
  author: string;
  refs: string;
}

// Search commits with various filters
export async function searchCommits(
  repoPath: string,
  filter: SearchFilter,
  limit: number = 100
): Promise<SearchResult[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const args: string[] = ['log', `--max-count=${limit}`, '--pretty=format:%H|%ai|%s|%an|%D'];
    
    // Add branch filter
    if (filter.branch) {
      args.push(filter.branch);
    } else {
      args.push('--all');
    }
    
    // Add author filter
    if (filter.author) {
      args.push(`--author=${filter.author}`);
    }
    
    // Add date filters
    if (filter.dateFrom) {
      args.push(`--since=${filter.dateFrom}`);
    }
    if (filter.dateTo) {
      args.push(`--until=${filter.dateTo}`);
    }
    
    // Add message filter (grep) - only for non-hash queries
    if (filter.query && !/^[0-9a-f]{6,40}$/i.test(filter.query)) {
      args.push(`--grep=${filter.query}`);
      args.push(`--regexp-ignore-case`);
    }
    
    const result = await git.raw(args);
    
    if (!result || result.trim() === '') {
      return [];
    }
    
    const lines = result.trim().split('\n');
    const commits: SearchResult[] = lines.map(line => {
      const [hash, date, message, author, refs] = line.split('|');
      return { hash, date, message, author, refs: refs || '' };
    });
    
    // Filter by query after getting results
    if (filter.query) {
      const query = filter.query.toLowerCase();
      const isHashQuery = /^[0-9a-f]{6,40}$/i.test(filter.query);
      
      return commits.filter(c => {
        if (isHashQuery) {
          // For hash queries, check if commit hash starts with the query
          return c.hash.toLowerCase().startsWith(query);
        } else {
          // For text queries, search in both message and hash
          return c.message.toLowerCase().includes(query) ||
                 c.hash.toLowerCase().includes(query);
        }
      });
    }
    
    return commits;
  } catch (error) {
    console.error('Error searching commits:', error);
    return [];
  }
}

// Search across multiple repositories
export async function searchCommitsMultiRepo(
  repoPaths: string[],
  filter: SearchFilter,
  limit: number = 100
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();
  
  for (const repoPath of repoPaths) {
    try {
      const commits = await searchCommits(repoPath, filter, limit);
      if (commits.length > 0) {
        results.set(repoPath, commits);
      }
    } catch (error) {
      console.error(`Error searching repo ${repoPath}:`, error);
    }
  }
  
  return results;
}

// Get unique authors from repository for filter suggestions
export async function getAuthors(repoPath: string): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const result = await git.raw(['log', '--all', '--format=%an', '--no-merges']);
    if (!result || result.trim() === '') {
      return [];
    }
    
    const authors = result.trim().split('\n');
    // Remove duplicates and sort
    return [...new Set(authors)].sort();
  } catch (error) {
    console.error('Error getting authors:', error);
    return [];
  }
}

// ============================================================================
// REMOTE MANAGEMENT
// ============================================================================

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  branches: string[];
}

// Get all remotes for a repository
export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const remotes = await git.getRemotes(true);
    const remoteInfos: RemoteInfo[] = [];
    
    for (const remote of remotes) {
      // Get remote branches
      const branches: string[] = [];
      try {
        const branchResult = await git.raw(['branch', '-r', '--list', `${remote.name}/*`]);
        if (branchResult.trim()) {
          branches.push(
            ...branchResult
              .trim()
              .split('\n')
              .map(b => b.trim().replace(`${remote.name}/`, ''))
              .filter(b => b && b !== 'HEAD')
          );
        }
      } catch (error) {
        console.warn(`Error getting branches for remote ${remote.name}:`, error);
      }
      
      remoteInfos.push({
        name: remote.name,
        fetchUrl: remote.refs.fetch || '',
        pushUrl: remote.refs.push || remote.refs.fetch || '',
        branches,
      });
    }
    
    return remoteInfos;
  } catch (error) {
    console.error('Error getting remotes:', error);
    throw error;
  }
}

// Add a new remote
export async function addRemote(repoPath: string, name: string, url: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Validate remote name (no spaces, special chars)
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      throw new Error('Remote name can only contain letters, numbers, dots, underscores, and hyphens');
    }
    
    // Check if remote already exists
    const remotes = await git.getRemotes();
    if (remotes.some(r => r.name === name)) {
      throw new Error(`Remote '${name}' already exists`);
    }
    
    await git.addRemote(name, url);
  } catch (error) {
    console.error('Error adding remote:', error);
    throw error;
  }
}

// Remove a remote
export async function removeRemote(repoPath: string, name: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check if remote exists
    const remotes = await git.getRemotes();
    if (!remotes.some(r => r.name === name)) {
      throw new Error(`Remote '${name}' does not exist`);
    }
    
    await git.removeRemote(name);
  } catch (error) {
    console.error('Error removing remote:', error);
    throw error;
  }
}

// Rename a remote
export async function renameRemote(repoPath: string, oldName: string, newName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Validate new remote name
    if (!/^[a-zA-Z0-9._-]+$/.test(newName)) {
      throw new Error('Remote name can only contain letters, numbers, dots, underscores, and hyphens');
    }
    
    // Check if old remote exists
    const remotes = await git.getRemotes();
    if (!remotes.some(r => r.name === oldName)) {
      throw new Error(`Remote '${oldName}' does not exist`);
    }
    
    // Check if new name already exists
    if (remotes.some(r => r.name === newName)) {
      throw new Error(`Remote '${newName}' already exists`);
    }
    
    await git.raw(['remote', 'rename', oldName, newName]);
  } catch (error) {
    console.error('Error renaming remote:', error);
    throw error;
  }
}

// Update remote URL
export async function setRemoteUrl(repoPath: string, name: string, url: string, isPushUrl: boolean = false): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check if remote exists
    const remotes = await git.getRemotes();
    if (!remotes.some(r => r.name === name)) {
      throw new Error(`Remote '${name}' does not exist`);
    }
    
    const args = ['remote', 'set-url'];
    if (isPushUrl) {
      args.push('--push');
    }
    args.push(name, url);
    
    await git.raw(args);
  } catch (error) {
    console.error('Error setting remote URL:', error);
    throw error;
  }
}

// Fetch from a specific remote
export async function fetchRemote(repoPath: string, remoteName: string, prune: boolean = false): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const options: string[] = [remoteName];
    if (prune) {
      options.push('--prune');
    }
    
    await git.fetch(options);
    
    // Invalidate relevant caches
    gitCache.invalidate(repoPath, 'branches');
    gitCache.invalidate(repoPath, 'commitDetails');
  } catch (error) {
    console.error('Error fetching from remote:', error);
    throw error;
  }
}

// Prune remote-tracking branches
export async function pruneRemote(repoPath: string, remoteName: string): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const result = await git.raw(['remote', 'prune', remoteName, '--dry-run']);
    const prunedBranches: string[] = [];
    
    if (result.trim()) {
      const lines = result.split('\n');
      for (const line of lines) {
        const match = line.match(/\* \[would prune\] (.+)/);
        if (match) {
          prunedBranches.push(match[1]);
        }
      }
    }
    
    // Actually prune if there are branches to prune
    if (prunedBranches.length > 0) {
      await git.raw(['remote', 'prune', remoteName]);
      gitCache.invalidate(repoPath, 'branches');
    }
    
    return prunedBranches;
  } catch (error) {
    console.error('Error pruning remote:', error);
    throw error;
  }
}

// Set upstream branch for current branch
export async function setUpstream(repoPath: string, remoteName: string, remoteBranch: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.raw(['branch', '--set-upstream-to', `${remoteName}/${remoteBranch}`]);
  } catch (error) {
    console.error('Error setting upstream:', error);
    throw error;
  }
}

// Get upstream branch for current branch
export async function getUpstream(repoPath: string): Promise<{ remote: string; branch: string } | null> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const result = await git.raw(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    const upstream = result.trim();
    
    if (!upstream || upstream === '@{upstream}') {
      return null;
    }
    
    const [remote, ...branchParts] = upstream.split('/');
    return {
      remote,
      branch: branchParts.join('/'),
    };
  } catch (error) {
    // No upstream configured
    return null;
  }
}

// ==================== TAG MANAGEMENT ====================

// Get all tags (local and remote) with details
export async function getTags(repoPath: string): Promise<TagInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  const cacheKey = 'tags';
  
  try {
    // Check cache first
    const cached = gitCache.get(repoPath, cacheKey);
    if (cached) {
      return cached as TagInfo[];
    }
    
    // Get all tags with their commit hashes
    const tagsOutput = await git.raw(['tag', '-l', '--format=%(refname:short)|%(objectname)|%(objecttype)']);
    const tags: TagInfo[] = [];
    
    if (tagsOutput.trim()) {
      const lines = tagsOutput.trim().split('\n');
      
      for (const line of lines) {
        const [name, objectHash, objectType] = line.split('|');
        
        if (!name) continue;
        
        // For annotated tags, get the commit hash and annotation details
        if (objectType === 'tag') {
          try {
            const tagDetails = await git.raw(['show', '--format=%H|%an|%aI|%B', '--no-patch', name]);
            const [commitHash, tagger, date, ...messageLines] = tagDetails.trim().split('\n');
            const [hash] = commitHash.split('|');
            const [, taggerName] = commitHash.split('|');
            const [, , isoDate] = commitHash.split('|');
            const message = messageLines.join('\n').trim();
            
            tags.push({
              name,
              commitHash: hash || objectHash,
              type: 'annotated',
              tagger: taggerName,
              date: isoDate,
              message: message || undefined,
            });
          } catch (error) {
            // Fallback if show fails
            tags.push({
              name,
              commitHash: objectHash,
              type: 'annotated',
            });
          }
        } else {
          // Lightweight tag - points directly to a commit
          tags.push({
            name,
            commitHash: objectHash,
            type: 'lightweight',
          });
        }
      }
    }
    
    // Sort tags by name
    tags.sort((a, b) => a.name.localeCompare(b.name));
    
    // Cache the result
    gitCache.set(repoPath, cacheKey, tags);
    
    return tags;
  } catch (error) {
    console.error('Error getting tags:', error);
    throw error;
  }
}

// Create a lightweight tag
export async function createLightweightTag(repoPath: string, tagName: string, commitHash?: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Validate tag name
    if (!/^[a-zA-Z0-9._\/-]+$/.test(tagName)) {
      throw new Error('Tag name can only contain letters, numbers, dots, underscores, slashes, and hyphens');
    }
    
    // Check if tag already exists
    const existingTags = await getTags(repoPath);
    if (existingTags.some(t => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' already exists`);
    }
    
    const args = ['tag', tagName];
    if (commitHash) {
      args.push(commitHash);
    }
    
    await git.raw(args);
    
    // Invalidate cache
    gitCache.invalidate(repoPath, 'tags');
  } catch (error) {
    console.error('Error creating lightweight tag:', error);
    throw error;
  }
}

// Create an annotated tag
export async function createAnnotatedTag(repoPath: string, tagName: string, message: string, commitHash?: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Validate tag name
    if (!/^[a-zA-Z0-9._\/-]+$/.test(tagName)) {
      throw new Error('Tag name can only contain letters, numbers, dots, underscores, slashes, and hyphens');
    }
    
    // Check if tag already exists
    const existingTags = await getTags(repoPath);
    if (existingTags.some(t => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' already exists`);
    }
    
    if (!message || message.trim() === '') {
      throw new Error('Annotated tags require a message');
    }
    
    const args = ['tag', '-a', tagName, '-m', message];
    if (commitHash) {
      args.push(commitHash);
    }
    
    await git.raw(args);
    
    // Invalidate cache
    gitCache.invalidate(repoPath, 'tags');
  } catch (error) {
    console.error('Error creating annotated tag:', error);
    throw error;
  }
}

// Delete a local tag
export async function deleteTag(repoPath: string, tagName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check if tag exists
    const existingTags = await getTags(repoPath);
    if (!existingTags.some(t => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' does not exist`);
    }
    
    await git.raw(['tag', '-d', tagName]);
    
    // Invalidate cache
    gitCache.invalidate(repoPath, 'tags');
  } catch (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
}

// Delete a remote tag
export async function deleteRemoteTag(repoPath: string, remoteName: string, tagName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Verify remote exists
    const remotes = await git.getRemotes();
    if (!remotes.some(r => r.name === remoteName)) {
      throw new Error(`Remote '${remoteName}' does not exist`);
    }
    
    await git.push([remoteName, ':refs/tags/' + tagName]);
    
    // Invalidate cache
    gitCache.invalidate(repoPath, 'tags');
  } catch (error) {
    console.error('Error deleting remote tag:', error);
    throw error;
  }
}

// Push tag(s) to remote
export async function pushTags(repoPath: string, remoteName: string, tagName?: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Verify remote exists
    const remotes = await git.getRemotes();
    if (!remotes.some(r => r.name === remoteName)) {
      throw new Error(`Remote '${remoteName}' does not exist`);
    }
    
    if (tagName) {
      // Push specific tag
      await git.push([remoteName, 'refs/tags/' + tagName]);
    } else {
      // Push all tags
      await git.push([remoteName, '--tags']);
    }
  } catch (error) {
    console.error('Error pushing tags:', error);
    throw error;
  }
}

// Checkout a tag (creates detached HEAD)
export async function checkoutTag(repoPath: string, tagName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check if tag exists
    const existingTags = await getTags(repoPath);
    if (!existingTags.some(t => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' does not exist`);
    }
    
    // Checkout creates a detached HEAD state
    await git.checkout(tagName);
    
    // Invalidate caches
    gitCache.invalidate(repoPath, 'repositoryInfo');
    gitCache.invalidate(repoPath, 'branches');
  } catch (error) {
    console.error('Error checking out tag:', error);
    throw error;
  }
}

// Checkout a commit (detached HEAD)
export async function checkoutCommit(repoPath: string, commitHash: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Basic validation that the object exists
    await git.revparse([commitHash]);

    await git.checkout(commitHash);

    // Invalidate caches
    gitCache.invalidate(repoPath, 'repositoryInfo');
    gitCache.invalidate(repoPath, 'branches');
  } catch (error) {
    console.error('Error checking out commit:', error);
    throw error;
  }
}

// Get tag details (for a specific tag)
export async function getTagDetails(repoPath: string, tagName: string): Promise<TagInfo | null> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const tags = await getTags(repoPath);
    const tag = tags.find(t => t.name === tagName);
    
    if (!tag) {
      return null;
    }
    
    return tag;
  } catch (error) {
    console.error('Error getting tag details:', error);
    throw error;
  }
}

// Get file content at HEAD
export async function getFileContent(repoPath: string, filePath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Get file content from HEAD
    const content = await git.show([`HEAD:${filePath}`]);
    return content;
  } catch (error) {
    console.error('Error getting file content:', error);
    // If file doesn't exist in HEAD, try to read from working directory
    try {
      const fullPath = path.join(repoPath, filePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
      }
    } catch (fsError) {
      console.error('Error reading file from filesystem:', fsError);
    }
    throw error;
  }
}

// Get git blame for a file
export async function getFileBlame(repoPath: string, filePath: string): Promise<BlameLine[]> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Run git blame with porcelain format for easier parsing
    const result = await git.raw([
      'blame',
      '--line-porcelain',
      'HEAD',
      '--',
      filePath
    ]);
    
    const lines = result.split('\n');
    const blameData: BlameLine[] = [];
    let currentBlame: Partial<BlameLine> = {};
    let lineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line) continue;
      
      // New blame block starts with a commit hash
      if (line.match(/^[0-9a-f]{40}/)) {
        const parts = line.split(' ');
        currentBlame.hash = parts[0];
        lineNumber = parseInt(parts[2], 10);
        currentBlame.lineNumber = lineNumber;
      } else if (line.startsWith('author ')) {
        currentBlame.author = line.substring(7);
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12), 10);
        currentBlame.date = new Date(timestamp * 1000).toISOString();
      } else if (line.startsWith('summary ')) {
        currentBlame.summary = line.substring(8);
      } else if (line.startsWith('\t')) {
        // This is the actual line content
        currentBlame.content = line.substring(1);
        
        // We have all the data for this line, add it
        if (currentBlame.hash && currentBlame.author && currentBlame.date && currentBlame.lineNumber) {
          blameData.push({
            lineNumber: currentBlame.lineNumber,
            hash: currentBlame.hash,
            author: currentBlame.author,
            date: currentBlame.date,
            content: currentBlame.content || '',
            summary: currentBlame.summary || '',
          });
        }
        
        // Reset for next line
        currentBlame = {};
      }
    }
    
    return blameData;
  } catch (error) {
    console.error('Error getting file blame:', error);
    throw error;
  }
}

// ============================================================================
// INTERACTIVE REBASE OPERATIONS
// ============================================================================

export interface RebaseCommit {
  hash: string;
  shortHash: string;
  action: 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';
  message: string;
  author: string;
  date: string;
}

export interface RebasePlan {
  commits: RebaseCommit[];
  currentBranch: string;
  targetBranch: string;
  targetCommit: string;
}

export interface RebaseStatus {
  inProgress: boolean;
  currentCommit?: string;
  remainingCommits?: number;
  hasConflicts?: boolean;
  conflictedFiles?: string[];
}

// Get commits that would be rebased
export async function getRebasePlan(
  repoPath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<RebasePlan> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Get the merge-base (common ancestor)
    const mergeBase = await git.raw([
      'merge-base',
      sourceBranch,
      targetBranch
    ]);
    
    const baseCommit = mergeBase.trim();
    
    // Get commits between base and source branch
    const logResult = await git.raw([
      'log',
      '--format=%H%x00%h%x00%s%x00%an%x00%ai',
      '--reverse',
      `${baseCommit}..${sourceBranch}`
    ]);
    
    const commits: RebaseCommit[] = [];
    
    if (logResult.trim()) {
      const commitLines = logResult.trim().split('\n');
      
      for (const line of commitLines) {
        const [hash, shortHash, message, author, date] = line.split('\x00');
        
        if (hash && message) {
          commits.push({
            hash,
            shortHash,
            action: 'pick',
            message,
            author,
            date,
          });
        }
      }
    }
    
    return {
      commits,
      currentBranch: sourceBranch,
      targetBranch,
      targetCommit: baseCommit,
    };
  } catch (error) {
    console.error('Error getting rebase plan:', error);
    throw error;
  }
}

// Start interactive rebase with a custom plan
export async function startInteractiveRebase(
  repoPath: string,
  targetBranch: string,
  rebasePlan: RebaseCommit[]
): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check for uncommitted changes
    const status = await git.status();
    if (status.files.length > 0) {
      throw new Error('Cannot start rebase: you have uncommitted changes. Please commit or stash them first.');
    }
    
    // Build the rebase todo content
    const todoLines = rebasePlan.map(commit => {
      return `${commit.action} ${commit.hash} ${commit.message}`;
    }).join('\n');
    
    // Create a temporary file for our custom plan
    const rebaseTodoBackup = path.join(repoPath, '.git', 'GITLOOM_REBASE_TODO');
    fs.writeFileSync(rebaseTodoBackup, todoLines, 'utf-8');
    
    // Create a script that will copy our plan to the git-rebase-todo file.
    // This script will be used as GIT_SEQUENCE_EDITOR.
    const isWindows = process.platform === 'win32';
    let editorScript: string;
    let editorScriptPath: string;
    
    if (isWindows) {
      // Git for Windows executes sequence editors via sh, and raw `D:\...\file.bat`
      // often fails (backslashes get eaten). PowerShell is a reliable cross-shell entry.
      editorScriptPath = path.join(repoPath, '.git', 'GITLOOM_EDITOR.ps1');
      editorScript = [
        'param([Parameter(Mandatory=$true)][string]$TodoPath)',
        `$src = '${rebaseTodoBackup.replace(/'/g, "''")}'`,
        'Copy-Item -LiteralPath $src -Destination $TodoPath -Force | Out-Null'
      ].join('\r\n') + '\r\n';
      fs.writeFileSync(editorScriptPath, editorScript, 'utf-8');
    } else {
      editorScriptPath = path.join(repoPath, '.git', 'GITLOOM_EDITOR.sh');
      editorScript = `#!/bin/sh\ncp "${rebaseTodoBackup}" "$1"`;
      fs.writeFileSync(editorScriptPath, editorScript, 'utf-8');
      fs.chmodSync(editorScriptPath, '755');
    }
    
    const rebaseMergePath = path.join(repoPath, '.git', 'rebase-merge');
    const rebaseApplyPath = path.join(repoPath, '.git', 'rebase-apply');

    // Start the rebase with our custom editor
    try {
      const sequenceEditor = isWindows
        ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${editorScriptPath}"`
        : editorScriptPath;

      await git.env({
        ...process.env,
        GIT_SEQUENCE_EDITOR: sequenceEditor
      }).raw([
        'rebase',
        '-i',
        '--autosquash',
        targetBranch
      ]);
      
      // If we get here without error, rebase completed successfully
      // Clean up temporary files
      if (fs.existsSync(rebaseTodoBackup)) {
        fs.unlinkSync(rebaseTodoBackup);
      }
      if (fs.existsSync(editorScriptPath)) {
        fs.unlinkSync(editorScriptPath);
      }
      
      return {
        inProgress: false,
      };
    } catch (rebaseError: any) {
      // Git returns non-zero for several cases:
      // - rebase actually started and is waiting (conflicts, edit/reword, etc.)
      // - rebase failed to start at all (e.g. couldn't run sequence editor)
      // Distinguish these to avoid showing a phantom "Continue" state in the UI.
      const actuallyInProgress = fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath);

      if (!actuallyInProgress) {
        // Clean up temporary files because the rebase didn't start.
        if (fs.existsSync(rebaseTodoBackup)) {
          fs.unlinkSync(rebaseTodoBackup);
        }
        if (fs.existsSync(editorScriptPath)) {
          fs.unlinkSync(editorScriptPath);
        }

        throw rebaseError;
      }

      // Rebase started but has conflicts or is waiting for user input.
      const statusAfter = await git.status();
      const conflictedFiles = statusAfter.conflicted || [];

      // Don't clean up scripts yet, we might need them for continue.
      return {
        inProgress: true,
        hasConflicts: conflictedFiles.length > 0,
        conflictedFiles,
      };
    }
  } catch (error) {
    console.error('Error starting interactive rebase:', error);
    throw error;
  }
}

// Get current rebase status
export async function getRebaseStatus(repoPath: string): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    const rebaseMergePath = path.join(repoPath, '.git', 'rebase-merge');
    const rebaseApplyPath = path.join(repoPath, '.git', 'rebase-apply');
    
    const inProgress = fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath);
    
    if (!inProgress) {
      return { inProgress: false };
    }
    
    // Get conflicted files
    const status = await git.status();
    const conflictedFiles = status.conflicted || [];
    
    // Try to read rebase state
    let currentCommit: string | undefined;
    let remainingCommits: number | undefined;
    
    if (fs.existsSync(rebaseMergePath)) {
      const headNamePath = path.join(rebaseMergePath, 'head-name');
      const ontoPath = path.join(rebaseMergePath, 'onto');
      const msgNumPath = path.join(rebaseMergePath, 'msgnum');
      const endPath = path.join(rebaseMergePath, 'end');
      
      if (fs.existsSync(msgNumPath) && fs.existsSync(endPath)) {
        const msgNum = parseInt(fs.readFileSync(msgNumPath, 'utf-8').trim(), 10);
        const end = parseInt(fs.readFileSync(endPath, 'utf-8').trim(), 10);
        remainingCommits = end - msgNum;
      }
    }
    
    return {
      inProgress: true,
      currentCommit,
      remainingCommits,
      hasConflicts: conflictedFiles.length > 0,
      conflictedFiles,
    };
  } catch (error) {
    console.error('Error getting rebase status:', error);
    return { inProgress: false };
  }
}

// Continue rebase after resolving conflicts
export async function continueRebase(repoPath: string): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Check if there are still conflicts
    const status = await git.status();
    if (status.conflicted && status.conflicted.length > 0) {
      throw new Error('Cannot continue rebase: there are unresolved conflicts');
    }
    
    // Continue the rebase
    try {
      await git.rebase(['--continue']);
      
      // Rebase completed successfully - clean up temporary files
      const backupPath = path.join(repoPath, '.git', 'GITLOOM_REBASE_TODO');
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      
      const editorScriptCmd = path.join(repoPath, '.git', 'GITLOOM_EDITOR.cmd');
      if (fs.existsSync(editorScriptCmd)) {
        fs.unlinkSync(editorScriptCmd);
      }

      const editorScriptBat = path.join(repoPath, '.git', 'GITLOOM_EDITOR.bat');
      if (fs.existsSync(editorScriptBat)) {
        fs.unlinkSync(editorScriptBat);
      }

      const editorScriptPs1 = path.join(repoPath, '.git', 'GITLOOM_EDITOR.ps1');
      if (fs.existsSync(editorScriptPs1)) {
        fs.unlinkSync(editorScriptPs1);
      }
      
      const editorScriptSh = path.join(repoPath, '.git', 'GITLOOM_EDITOR.sh');
      if (fs.existsSync(editorScriptSh)) {
        fs.unlinkSync(editorScriptSh);
      }
      
      return { inProgress: false };
    } catch (error: any) {
      // Rebase still in progress or new conflicts
      return await getRebaseStatus(repoPath);
    }
  } catch (error) {
    console.error('Error continuing rebase:', error);
    throw error;
  }
}

// Abort rebase
export async function abortRebase(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.rebase(['--abort']);
    
    // Clean up any backup files
    const backupPath = path.join(repoPath, '.git', 'GITLOOM_REBASE_TODO');
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    
    // Clean up editor scripts
    const editorScriptCmd = path.join(repoPath, '.git', 'GITLOOM_EDITOR.cmd');
    if (fs.existsSync(editorScriptCmd)) {
      fs.unlinkSync(editorScriptCmd);
    }

    const editorScriptBat = path.join(repoPath, '.git', 'GITLOOM_EDITOR.bat');
    if (fs.existsSync(editorScriptBat)) {
      fs.unlinkSync(editorScriptBat);
    }

    const editorScriptPs1 = path.join(repoPath, '.git', 'GITLOOM_EDITOR.ps1');
    if (fs.existsSync(editorScriptPs1)) {
      fs.unlinkSync(editorScriptPs1);
    }
    
    const editorScriptSh = path.join(repoPath, '.git', 'GITLOOM_EDITOR.sh');
    if (fs.existsSync(editorScriptSh)) {
      fs.unlinkSync(editorScriptSh);
    }
    
    // Invalidate cache
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error aborting rebase:', error);
    throw error;
  }
}

// Skip current commit during rebase
export async function skipRebaseCommit(repoPath: string): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    await git.rebase(['--skip']);
    
    // Check status after skip
    return await getRebaseStatus(repoPath);
  } catch (error: any) {
    // If skip completes the rebase
    if (error.message && error.message.includes('No rebase in progress')) {
      return { inProgress: false };
    }
    
    console.error('Error skipping rebase commit:', error);
    throw error;
  }
}

// Edit a commit message during rebase
export async function editRebaseCommitMessage(
  repoPath: string,
  commitHash: string,
  newMessage: string
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  
  try {
    // Use commit --amend to change the message
    await git.raw(['commit', '--amend', '-m', newMessage]);
    
    // Invalidate cache
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error('Error editing commit message:', error);
    throw error;
  }
}

