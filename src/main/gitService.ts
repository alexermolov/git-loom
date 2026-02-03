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

export async function pushRepository(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  const branchSummary: BranchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error('Cannot push: no current branch');
  }

  // If upstream exists, normal push is fine.
  if (status.tracking) {
    await git.push();
  } else {
    // No upstream: try to set upstream to origin/<branch>
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === 'origin');
    if (!hasOrigin) {
      throw new Error('Cannot push: no tracking branch and no origin remote');
    }
    await git.push(['-u', 'origin', currentBranch]);
  }

  // Invalidate cache after push
  gitCache.invalidate(repoPath);
}

export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if there are uncommitted changes
  const status = await git.status();
  if (status.files.length > 0) {
    throw new Error('Cannot checkout: you have uncommitted changes. Please commit or stash them first.');
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

export async function mergeBranch(repoPath: string, branchName: string): Promise<void> {
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
    await git.merge([targetBranch]);
    // Invalidate cache after successful merge
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    if (error.message && error.message.includes('CONFLICT')) {
      throw new Error('Merge conflict detected. Please resolve conflicts manually.');
    }
    throw error;
  }
}

export async function createBranch(repoPath: string, branchName: string, startPoint?: string): Promise<void> {
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
    additions: file.insertions,
    deletions: file.deletions
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
export async function getRepositoryInfo(repoPath: string): Promise<RepositoryInfo> {
  // Check cache first (short TTL for repo info as it changes frequently)
  const cached = gitCache.get<RepositoryInfo>(repoPath, 'repoInfo');
  if (cached) {
    return cached;
  }

  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Fetch from remote
    await git.fetch();

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
      const revList = await git.raw([
        'rev-list',
        '--left-right',
        '--count',
        `${currentBranch}...origin/${currentBranch}`
      ]);
      const [outgoing, incoming] = revList.trim().split('\t').map(Number);
      outgoingCommits = outgoing || 0;
      incomingCommits = incoming || 0;
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

    // Cache with shorter TTL for frequently changing data
    gitCache.set(repoPath, 'repoInfo', repoInfo);

    return repoInfo;
  } catch (error) {
    console.error('Error getting repository info:', error);
    throw error;
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

  try {
    // Get all branches including remotes
    const branchSummary: BranchSummary = await git.branch(['-a', '-v']);
    const branches: BranchInfo[] = [];

    for (const [branchName, branchData] of Object.entries(branchSummary.branches)) {
      try {
        // Get the last commit info for this branch
        const log = await git.log({
          maxCount: 1,
          from: branchName,
        });

        const lastCommit = log.latest;

        branches.push({
          name: branchName,
          commit: branchData.commit,
          lastCommitDate: lastCommit?.date || '',
          lastCommitMessage: lastCommit?.message || '',
          author: lastCommit?.author_name || '',
        });
      } catch (error) {
        // If we can't get commit info, still add the branch
        branches.push({
          name: branchName,
          commit: branchData.commit,
          lastCommitDate: '',
          lastCommitMessage: '',
          author: '',
        });
      }
    }

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
    // Get the diff stat for the commit
    const diffSummary = await git.diffSummary([`${commitHash}^`, commitHash]);
    
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

// Create commit
export async function createCommit(repoPath: string, message: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.commit(message);
    // Invalidate file tree cache after commit
    gitCache.invalidate(repoPath, 'fileTree');
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

// Get file content from the working directory
export async function getFileContent(repoPath: string, filePath: string): Promise<string> {
  try {
    const fullPath = path.join(repoPath, filePath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file content:', error);
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
    
    // Add message/hash filter (grep)
    if (filter.query) {
      // Check if query looks like a hash
      if (/^[0-9a-f]{6,40}$/i.test(filter.query)) {
        args.push(`--grep=${filter.query}`);
        args.push(`--regexp-ignore-case`);
      } else {
        args.push(`--grep=${filter.query}`);
        args.push(`--regexp-ignore-case`);
      }
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
    
    // Additional fuzzy search on results if query provided
    if (filter.query && !/^[0-9a-f]{6,40}$/i.test(filter.query)) {
      const query = filter.query.toLowerCase();
      return commits.filter(c => 
        c.message.toLowerCase().includes(query) ||
        c.hash.toLowerCase().includes(query)
      );
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
