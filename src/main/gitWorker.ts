/**
 * Git Worker Thread
 * Handles heavy Git operations in a separate thread to prevent UI blocking
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';

export interface GitWorkerTask {
  id: string;
  operation: string;
  repoPath: string;
  params?: any;
}

export interface GitWorkerResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Git Worker Pool for managing multiple worker threads
 */
export class GitWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: GitWorkerTask[] = [];
  private pendingTasks: Map<string, (result: GitWorkerResult) => void> = new Map();
  private readonly workerCount: number;
  private currentWorkerIndex: number = 0;

  constructor(workerCount: number = 2) {
    this.workerCount = workerCount;
  }

  /**
   * Initialize worker pool (called when needed)
   */
  private ensureWorkers(): void {
    if (this.workers.length > 0) return;

    // Note: In production, workers would be separate files
    // For now, we'll execute tasks directly in the main thread
    // but with the infrastructure to easily add workers later
  }

  /**
   * Execute a Git operation
   */
  async execute<T>(operation: string, repoPath: string, params?: any): Promise<T> {
    // For now, execute directly (can be moved to worker thread later)
    const git: SimpleGit = simpleGit(repoPath);
    
    try {
      switch (operation) {
        case 'log':
          return await this.executeLog(git, params) as T;
        case 'status':
          return await git.status() as T;
        case 'branch':
          return await git.branch() as T;
        case 'diff':
          return await this.executeDiff(git, params) as T;
        case 'show':
          return await this.executeShow(git, params) as T;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error: any) {
      throw new Error(`Git operation failed: ${error.message}`);
    }
  }

  /**
   * Execute log operation with pagination
   */
  private async executeLog(git: SimpleGit, params: any) {
    const { maxCount = 50, skip = 0, branch } = params || {};
    
    const args = [
      'log',
      '--format=%H%x1f%P%x1f%s%x1f%an%x1f%ai%x1f%D',
      '--date-order',
      '--topo-order',
      `--max-count=${maxCount}`,
      `--skip=${skip}`,
    ];

    if (branch && branch !== undefined && branch.trim().length > 0) {
      const normalizedBranch = branch.startsWith('remotes/') 
        ? branch.replace('remotes/', '') 
        : branch;
      args.push(normalizedBranch);
    } else {
      // Show all branches when no specific branch is selected
      args.push('--all');
    }

    const output = await git.raw(args);
    return this.parseLogOutput(output);
  }

  /**
   * Parse log output into structured format
   */
  private parseLogOutput(output: string) {
    const lines = output
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const commits = [];

    for (const line of lines) {
      const parts = line.split('\x1f');
      if (parts.length < 6) continue;

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

  /**
   * Execute diff operation with chunking
   */
  private async executeDiff(git: SimpleGit, params: any) {
    const { filePath, commitHash, maxLines } = params || {};
    
    if (!filePath) {
      throw new Error('File path is required for diff operation');
    }

    let args = ['diff', '--no-color'];
    
    if (commitHash) {
      args.push(commitHash);
    }
    
    args.push('--', filePath);

    const output = await git.raw(args);
    
    // If maxLines is specified, truncate the output
    if (maxLines && typeof maxLines === 'number') {
      const lines = output.split('\n');
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join('\n') + '\n... (diff truncated)';
      }
    }

    return output;
  }

  /**
   * Execute show operation for commit details
   */
  private async executeShow(git: SimpleGit, params: any) {
    const { commitHash, stat = true } = params || {};
    
    if (!commitHash) {
      throw new Error('Commit hash is required for show operation');
    }

    const args = ['show', commitHash];
    if (stat) {
      args.push('--stat');
    }

    return await git.raw(args);
  }

  /**
   * Cleanup worker pool
   */
  destroy(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.pendingTasks.clear();
    this.taskQueue = [];
  }
}

// Global worker pool instance
export const gitWorkerPool = new GitWorkerPool(2);
