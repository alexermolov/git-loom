import simpleGit, { SimpleGit, StatusResult, BranchSummary } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

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

export async function getCommitDetails(repoPath: string, branch?: string, maxCount: number = 200): Promise<CommitDetail[]> {
  const git: SimpleGit = simpleGit(repoPath);

  const normalizedBranch = branch?.startsWith('remotes/') ? branch.replace('remotes/', '') : branch;

  const args = [
    'log',
    '--format=%H|%P|%s|%an|%ai|%D',
    '--date-order',
    `--max-count=${maxCount}`,
  ];

  if (normalizedBranch && normalizedBranch.trim().length > 0) {
    args.push(normalizedBranch);
  } else {
    args.push('--all');
  }

  const output = await git.raw(args);
  const lines = output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const commits: CommitDetail[] = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 5) continue;

    const [hash, parentsStr, message, author, date, refsStr] = parts;
    const parents = parentsStr ? parentsStr.split(' ').filter(p => p.length > 0) : [];
    const refs = refsStr ? refsStr.split(',').map(r => r.trim()).filter(r => r.length > 0) : [];

    commits.push({
      hash,
      message,
      author,
      date,
      parents,
      refs,
    });
  }

  return commits;
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
    return;
  }

  const remotes = await git.getRemotes(true);
  const hasOrigin = remotes.some((r) => r.name === 'origin');
  if (!hasOrigin) {
    throw new Error('Cannot pull: no tracking branch and no origin remote');
  }

  await git.pull('origin', currentBranch, ['--ff-only']);
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
    return;
  }

  // No upstream: try to set upstream to origin/<branch>
  const remotes = await git.getRemotes(true);
  const hasOrigin = remotes.some((r) => r.name === 'origin');
  if (!hasOrigin) {
    throw new Error('Cannot push: no tracking branch and no origin remote');
  }

  await git.push(['-u', 'origin', currentBranch]);
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

    return {
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
  } catch (error) {
    console.error('Error getting repository info:', error);
    throw error;
  }
}

// Get commit history
export async function getCommits(repoPath: string, branch?: string): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const log = await git.log({
      maxCount: 100,
      ...(branch && { from: branch })
    });

    return log.all.map(commit => ({
      hash: commit.hash,
      date: commit.date,
      message: commit.message,
      author: commit.author_name,
      refs: commit.refs,
    }));
  } catch (error) {
    console.error('Error getting commits:', error);
    throw error;
  }
}

// Get file tree for repository
export async function getFileTree(repoPath: string, commitHash?: string): Promise<FileTreeNode> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // If no commit hash provided, get current working tree
    if (!commitHash) {
      return await buildFileTree(repoPath);
    }

    // Get file list for specific commit
    const files = await git.raw(['ls-tree', '-r', '--name-only', commitHash]);
    const fileList = files.trim().split('\n').filter(f => f);

    return buildTreeFromPaths(fileList, repoPath);
  } catch (error) {
    console.error('Error getting file tree:', error);
    throw error;
  }
}

// Build file tree from file system
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

    for (const entry of entries) {
      // Skip .git directory
      if (entry.name === '.git') continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        const childNode = await buildFileTree(fullPath, relPath);
        node.children!.push(childNode);
      } else {
        node.children!.push({
          name: entry.name,
          path: relPath,
          type: 'file',
        });
      }
    }

    // Sort: directories first, then files
    node.children!.sort((a, b) => {
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

// Get diff for a specific file in a commit
export async function getFileDiff(repoPath: string, commitHash: string, filePath: string): Promise<FileDiff> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get the diff for the specific file
    const diff = await git.diff([`${commitHash}^`, commitHash, '--', filePath]);
    
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

