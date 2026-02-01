export interface ElectronAPI {
  openFolder: () => Promise<string>;
  scanRepositories: (folderPath: string) => Promise<string[]>;
  getRepositoryInfo: (repoPath: string) => Promise<RepositoryInfo>;
  pullRepository: (repoPath: string) => Promise<RepositoryInfo>;
  pushRepository: (repoPath: string) => Promise<RepositoryInfo>;
  getCommits: (repoPath: string, branch?: string) => Promise<CommitInfo[]>;
  getFileTree: (repoPath: string, commitHash?: string) => Promise<FileTreeNode>;
  getBranches: (repoPath: string) => Promise<BranchInfo[]>;
  getGitGraph: (repoPath: string, branch?: string) => Promise<GitGraphRow[]>;
  getCommitDetails: (repoPath: string, branch?: string, maxCount?: number) => Promise<CommitDetail[]>;
  getCommitFiles: (repoPath: string, commitHash: string) => Promise<CommitFile[]>;
  getFileDiff: (repoPath: string, commitHash: string, filePath: string) => Promise<FileDiff>;
  getStatus: (repoPath: string) => Promise<FileStatus[]>;
  stageFiles: (repoPath: string, filePaths: string[]) => Promise<void>;
  unstageFiles: (repoPath: string, filePaths: string[]) => Promise<void>;
  createCommit: (repoPath: string, message: string) => Promise<void>;
  getWorkingFileDiff: (repoPath: string, filePath: string, staged: boolean) => Promise<FileDiff>;
  checkoutBranch: (repoPath: string, branchName: string) => Promise<RepositoryInfo>;
  mergeBranch: (repoPath: string, branchName: string) => Promise<RepositoryInfo>;
  getReflog: (repoPath: string, ref?: string, maxCount?: number) => Promise<ReflogEntry[]>;
  resetToCommit: (repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard') => Promise<void>;
  cherryPickCommit: (repoPath: string, commitHash: string) => Promise<void>;
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

export interface RepositoryInfo {
  path: string;
  name: string;
  currentBranch: string;
  branches: string[];
  incomingCommits: number;
  outgoingCommits: number;
  status: any;
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
