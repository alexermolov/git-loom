export interface ElectronAPI {
  openFolder: () => Promise<string>;
  scanRepositories: (folderPath: string) => Promise<string[]>;
  getRepositoryInfo: (repoPath: string, forceFetch?: boolean) => Promise<RepositoryInfo>;
  pullRepository: (repoPath: string) => Promise<RepositoryInfo>;
  pushRepository: (repoPath: string, options?: { force?: boolean; forceWithLease?: boolean }) => Promise<RepositoryInfo>;
  getCommits: (repoPath: string, branch?: string, skip?: number, limit?: number) => Promise<CommitInfo[]>;
  getUnpushedCommits: (repoPath: string) => Promise<CommitInfo[]>;
  getFileTree: (repoPath: string, commitHash?: string) => Promise<FileTreeNode>;
  getBranches: (repoPath: string) => Promise<BranchInfo[]>;
  getGitGraph: (repoPath: string, branch?: string) => Promise<GitGraphRow[]>;
  getCommitDetails: (repoPath: string, branch?: string, maxCount?: number) => Promise<CommitDetail[]>;
  getCommitFiles: (repoPath: string, commitHash: string) => Promise<CommitFile[]>;
  getFileDiff: (repoPath: string, commitHash: string, filePath: string) => Promise<FileDiff>;
  getStatus: (repoPath: string) => Promise<FileStatus[]>;
  stageFiles: (repoPath: string, filePaths: string[]) => Promise<void>;
  unstageFiles: (repoPath: string, filePaths: string[]) => Promise<void>;
  discardChanges: (repoPath: string, filePaths: string[]) => Promise<void>;
  createCommit: (repoPath: string, message: string) => Promise<void>;
  getWorkingFileDiff: (repoPath: string, filePath: string, staged: boolean) => Promise<FileDiff>;
  checkoutBranch: (repoPath: string, branchName: string) => Promise<RepositoryInfo>;
  stashAndCheckout: (repoPath: string, branchName: string) => Promise<RepositoryInfo>;
  discardAndCheckout: (repoPath: string, branchName: string) => Promise<RepositoryInfo>;
  mergeBranch: (repoPath: string, branchName: string, mergeMode?: 'auto' | 'no-ff' | 'ff-only') => Promise<RepositoryInfo>;
  // Branch management
  createBranch: (repoPath: string, branchName: string, startPoint?: string, switchAfterCreate?: boolean, pushAfterCreate?: boolean) => Promise<BranchInfo[]>;
  deleteBranch: (repoPath: string, branchName: string, force: boolean) => Promise<{ success: boolean; branches?: BranchInfo[]; warning?: string }>;
  deleteRemoteBranch: (repoPath: string, remoteName: string, branchName: string) => Promise<BranchInfo[]>;
  renameBranch: (repoPath: string, oldName: string, newName: string, renameRemote: boolean) => Promise<BranchInfo[]>;
  setUpstreamBranch: (repoPath: string, localBranch: string, remoteName: string, remoteBranch: string) => Promise<BranchInfo[]>;
  unsetUpstreamBranch: (repoPath: string, branchName: string) => Promise<BranchInfo[]>;
  compareBranches: (repoPath: string, baseBranch: string, compareBranch: string) => Promise<BranchComparison>;
  getReflog: (repoPath: string, ref?: string, maxCount?: number) => Promise<ReflogEntry[]>;
  resetToCommit: (repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard') => Promise<void>;
  cherryPickCommit: (repoPath: string, commitHash: string) => Promise<void>;
  revertCommit: (repoPath: string, commitHash: string) => Promise<void>;
  abortRevert: (repoPath: string) => Promise<'aborted' | 'noop'>;
  continueRevert: (repoPath: string) => Promise<'continued' | 'noop'>;
  getFileContent: (repoPath: string, filePath: string) => Promise<string>;
  // Stash operations
  createStash: (repoPath: string, message?: string, includeUntracked?: boolean) => Promise<void>;
  getStashList: (repoPath: string) => Promise<StashEntry[]>;
  applyStash: (repoPath: string, index: number) => Promise<void>;
  popStash: (repoPath: string, index: number) => Promise<void>;
  dropStash: (repoPath: string, index: number) => Promise<void>;
  getStashDiff: (repoPath: string, index: number) => Promise<string>;
  getStashFiles: (repoPath: string, index: number) => Promise<CommitFile[]>;
  createBranchFromStash: (repoPath: string, index: number, branchName: string) => Promise<void>;
  clearAllStashes: (repoPath: string) => Promise<void>;
  // Conflict resolution
  getConflictedFiles: (repoPath: string) => Promise<string[]>;
  getFileConflicts: (repoPath: string, filePath: string) => Promise<ConflictFile>;
  resolveConflict: (repoPath: string, filePath: string, resolution: 'ours' | 'theirs' | 'both', conflictIndex?: number) => Promise<void>;
  resolveConflictManual: (repoPath: string, filePath: string, content: string) => Promise<void>;
  launchMergeTool: (repoPath: string, filePath: string) => Promise<void>;
  abortMerge: (repoPath: string) => Promise<void>;
  continueMerge: (repoPath: string) => Promise<void>;
  // Search operations
  searchCommits: (repoPath: string, filter: SearchFilter, limit?: number) => Promise<SearchResult[]>;
  searchCommitsMultiRepo: (repoPaths: string[], filter: SearchFilter, limit?: number) => Promise<Record<string, SearchResult[]>>;
  getAuthors: (repoPath: string) => Promise<string[]>;
  // Remote management
  getRemotes: (repoPath: string) => Promise<RemoteInfo[]>;
  addRemote: (repoPath: string, name: string, url: string) => Promise<void>;
  removeRemote: (repoPath: string, name: string) => Promise<void>;
  renameRemote: (repoPath: string, oldName: string, newName: string) => Promise<void>;
  setRemoteUrl: (repoPath: string, name: string, url: string, isPushUrl?: boolean) => Promise<void>;
  fetchRemote: (repoPath: string, remoteName: string, prune?: boolean) => Promise<void>;
  pruneRemote: (repoPath: string, remoteName: string) => Promise<string[]>;
  setUpstream: (repoPath: string, remoteName: string, remoteBranch: string) => Promise<void>;
  getUpstream: (repoPath: string) => Promise<{ remote: string; branch: string } | null>;
  // Tag management
  getTags: (repoPath: string) => Promise<TagInfo[]>;
  createLightweightTag: (repoPath: string, tagName: string, commitHash?: string) => Promise<void>;
  createAnnotatedTag: (repoPath: string, tagName: string, message: string, commitHash?: string) => Promise<void>;
  deleteTag: (repoPath: string, tagName: string) => Promise<void>;
  deleteRemoteTag: (repoPath: string, remoteName: string, tagName: string) => Promise<void>;
  pushTags: (repoPath: string, remoteName: string, tagName?: string) => Promise<void>;
  checkoutTag: (repoPath: string, tagName: string) => Promise<void>;
  checkoutCommit: (repoPath: string, commitHash: string) => Promise<void>;
  getTagDetails: (repoPath: string, tagName: string) => Promise<TagInfo | null>;
  // File editor operations
  getFileBlame: (repoPath: string, filePath: string) => Promise<BlameLine[]>;
  // Interactive rebase operations
  getRebasePlan: (repoPath: string, sourceBranch: string, targetBranch: string) => Promise<RebasePlan>;
  startInteractiveRebase: (repoPath: string, targetBranch: string, rebasePlan: RebaseCommit[]) => Promise<RebaseStatus>;
  getRebaseStatus: (repoPath: string) => Promise<RebaseStatus>;
  continueRebase: (repoPath: string) => Promise<RebaseStatus>;
  abortRebase: (repoPath: string) => Promise<void>;
  skipRebaseCommit: (repoPath: string) => Promise<RebaseStatus>;
  editRebaseCommitMessage: (repoPath: string, commitHash: string, newMessage: string) => Promise<void>;
}

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

export interface BranchComparison {
  ahead: number;
  behind: number;
  files: {
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
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

export interface StashEntry {
  index: number;
  hash: string;
  message: string;
  branch: string;
  date: string;
  author: string;
}

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

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  branches: string[];
}

export interface TagInfo {
  name: string;
  commitHash: string;
  message?: string;
  type: 'lightweight' | 'annotated';
  tagger?: string;
  date?: string;
}

export interface BlameLine {
  lineNumber: number;
  hash: string;
  author: string;
  date: string;
  content: string;
  summary: string;
}

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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
