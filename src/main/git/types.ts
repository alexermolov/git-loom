// Type definitions for Git operations

export interface RepositoryInfo {
  path: string;
  name: string;
  currentBranch: string;
  branches: string[];
  incomingCommits: number;
  outgoingCommits: number;
  isRebasing?: boolean;
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
  type: "file" | "directory";
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
  status: "added" | "modified" | "deleted" | "renamed";
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
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
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
  type: "lightweight" | "annotated";
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

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  branches: string[];
}

export interface PushRepositoryOptions {
  force?: boolean;
  forceWithLease?: boolean;
  setUpstream?: boolean;
}

export interface RebaseCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  action: "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";
}

export interface RebasePlan {
  commits: RebaseCommit[];
  sourceBranch: string;
  targetBranch: string;
  currentBranch: string;
  targetCommit: string;
}

export interface RebaseStatus {
  inProgress: boolean;
  hasConflicts?: boolean;
  conflictedFiles?: string[];
  currentCommit?: string;
  remainingCommits?: number;
}

export type AbortRevertResult = {
  success: boolean;
  message: string;
};

export type ContinueRevertResult = {
  success: boolean;
  message: string;
  hasConflicts?: boolean;
  conflictedFiles?: string[];
};
