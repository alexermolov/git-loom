import simpleGit, { SimpleGit, StatusResult } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { gitCache } from "../cache";
import { gitWorkerPool } from "../gitWorker";
import { FileStatus, FileDiff } from "./types";

/**
 * Get diff for a file in a commit
 */
export async function getFileDiff(
  repoPath: string,
  commitHash: string,
  filePath: string,
  maxLines?: number,
): Promise<FileDiff> {
  const cacheKey = { commitHash, filePath, maxLines };
  const cached = gitCache.get<FileDiff>(repoPath, "fileDiff", cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const diff = await gitWorkerPool.execute<string>("diff", repoPath, {
      filePath,
      commitHash,
      maxLines,
    });

    const lines = diff.split("\n");
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions++;
      }
    }

    const result: FileDiff = {
      path: filePath,
      diff,
      additions,
      deletions,
    };

    gitCache.set(repoPath, "fileDiff", result, cacheKey);

    return result;
  } catch (error) {
    console.error("Error getting file diff:", error);
    throw error;
  }
}

/**
 * Get diff for a working directory file
 */
export async function getWorkingFileDiff(
  repoPath: string,
  filePath: string,
  staged: boolean,
): Promise<FileDiff> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const args = staged ? ["--cached", "--", filePath] : ["--", filePath];
    const diff = await git.diff(args);

    const lines = diff.split("\n");
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
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
    console.error("Error getting working file diff:", error);
    throw error;
  }
}

/**
 * Get status of working directory and staging area
 */
export async function getStatus(repoPath: string): Promise<FileStatus[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const status: StatusResult = await git.status();
    const files: FileStatus[] = [];

    for (const file of status.staged) {
      files.push({
        path: file,
        status: "added",
        staged: true,
      });
    }

    for (const file of status.modified) {
      if (!status.staged.includes(file)) {
        files.push({
          path: file,
          status: "modified",
          staged: false,
        });
      }
    }

    for (const file of status.not_added) {
      files.push({
        path: file,
        status: "added",
        staged: false,
      });
    }

    for (const file of status.deleted) {
      files.push({
        path: file,
        status: "deleted",
        staged: status.staged.includes(file),
      });
    }

    for (const rename of status.renamed) {
      const fileData =
        typeof rename === "string" ? { from: rename, to: rename } : rename;

      files.push({
        path: fileData.to,
        status: "renamed",
        staged: true,
        oldPath: fileData.from,
      });
    }

    return files;
  } catch (error) {
    console.error("Error getting status:", error);
    throw error;
  }
}

/**
 * Stage files
 */
export async function stageFiles(
  repoPath: string,
  filePaths: string[],
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.add(filePaths);
  } catch (error) {
    console.error("Error staging files:", error);
    throw error;
  }
}

/**
 * Unstage files
 */
export async function unstageFiles(
  repoPath: string,
  filePaths: string[],
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.reset(["HEAD", "--", ...filePaths]);
  } catch (error) {
    console.error("Error unstaging files:", error);
    throw error;
  }
}

/**
 * Discard changes in files
 */
export async function discardChanges(
  repoPath: string,
  filePaths: string[],
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const status = await git.status();

    for (const filePath of filePaths) {
      if (status.not_added.includes(filePath)) {
        const fullPath = path.join(repoPath, filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } else {
        await git.checkout(["HEAD", "--", filePath]);
      }
    }

    gitCache.invalidate(repoPath, "status");
  } catch (error) {
    console.error("Error discarding changes:", error);
    throw error;
  }
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  repoPath: string,
  filePath: string,
): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const content = await git.show([`HEAD:${filePath}`]);
    return content;
  } catch (error) {
    const fullPath = path.join(repoPath, filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }
    throw error;
  }
}
