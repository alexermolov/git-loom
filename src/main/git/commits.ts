import simpleGit, { SimpleGit } from "simple-git";
import { gitCache } from "../cache";
import { gitWorkerPool } from "../gitWorker";
import { hasCommits } from "./utils";
import {
  CommitInfo,
  CommitDetail,
  GitGraphRow,
  CommitFile,
  FileDiff,
} from "./types";

/**
 * Get commit details for graph building
 */
export async function getCommitDetails(
  repoPath: string,
  branch?: string,
  maxCount: number = 200,
  skip: number = 0,
): Promise<CommitDetail[]> {
  const cacheKey = { branch, maxCount, skip };
  const cached = gitCache.get<CommitDetail[]>(
    repoPath,
    "commitDetails",
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  try {
    const commits = await gitWorkerPool.execute<CommitDetail[]>(
      "log",
      repoPath,
      {
        branch,
        maxCount,
        skip,
      },
    );

    gitCache.set(repoPath, "commitDetails", commits, cacheKey);
    return commits;
  } catch (error) {
    console.error("Error in getCommitDetails:", error);
    throw error;
  }
}

/**
 * Get commits with pagination support
 */
export async function getCommits(
  repoPath: string,
  branch?: string,
  skip: number = 0,
  limit: number = 25,
): Promise<CommitInfo[]> {
  const cacheKey = { branch, skip, limit };
  const cached = gitCache.get<CommitInfo[]>(repoPath, "commits", cacheKey);
  if (cached) {
    return cached;
  }

  const git: SimpleGit = simpleGit(repoPath);

  try {
    if (!(await hasCommits(git))) {
      return [];
    }

    const logOptions: any = {
      maxCount: limit,
    };

    if (skip > 0) {
      logOptions["--skip"] = skip.toString();
    }

    if (branch) {
      logOptions.from = branch;
    }

    const log = await git.log(logOptions);

    const commits = log.all.map((commit) => ({
      hash: commit.hash,
      date: commit.date,
      message: commit.message,
      author: commit.author_name,
      refs: commit.refs,
    }));

    gitCache.set(repoPath, "commits", commits, cacheKey);

    return commits;
  } catch (error) {
    console.error("Error getting commits:", error);
    throw error;
  }
}

/**
 * Get unpushed commits
 */
export async function getUnpushedCommits(
  repoPath: string,
): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const status = await git.status();
    if (!(await hasCommits(git))) {
      return [];
    }

    const currentBranch = status.current;
    if (!currentBranch) {
      return [];
    }

    const remotes = await git.getRemotes(true);
    const hasRemotes = remotes.length > 0;
    const preferredRemote =
      remotes.find((remote) => remote.name === "origin")?.name ||
      remotes[0]?.name;
    const upstream =
      status.tracking ||
      (preferredRemote ? `${preferredRemote}/${currentBranch}` : null);

    try {
      const log = upstream
        ? await git.log({
            from: upstream,
            to: currentBranch,
          })
        : await git.log({
            from: currentBranch,
          });

      const commits = log.all.map((commit) => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name,
        refs: commit.refs,
      }));

      return commits;
    } catch (error) {
      if (!hasRemotes) {
        throw error;
      }

      return [];
    }
  } catch (error) {
    console.error("Error getting unpushed commits:", error);
    throw error;
  }
}

/**
 * Get files changed in a commit
 */
export async function getCommitFiles(
  repoPath: string,
  commitHash: string,
): Promise<CommitFile[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    let diffSummary;
    try {
      diffSummary = await git.diffSummary([`${commitHash}^`, commitHash]);
    } catch (error) {
      diffSummary = await git.diffSummary([
        "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
        commitHash,
      ]);
    }

    const files: CommitFile[] = diffSummary.files.map((file: any) => {
      let status: "added" | "modified" | "deleted" | "renamed" = "modified";

      const insertions = "insertions" in file ? file.insertions : 0;
      const deletions = "deletions" in file ? file.deletions : 0;

      if (insertions > 0 && deletions === 0) {
        status = "added";
      } else if (insertions === 0 && deletions > 0) {
        status = "deleted";
      }

      if (file.file.includes(" => ")) {
        status = "renamed";
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
    console.error("Error getting commit files:", error);
    throw error;
  }
}

/**
 * Create a new commit
 */
export async function createCommit(
  repoPath: string,
  message: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.commit(message);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error creating commit:", error);
    throw error;
  }
}

/**
 * Reset to a specific commit
 */
export async function resetToCommit(
  repoPath: string,
  commitHash: string,
  mode: "soft" | "mixed" | "hard" = "mixed",
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.reset([`--${mode}`, commitHash]);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error resetting to commit:", error);
    throw error;
  }
}

/**
 * Cherry-pick a commit
 */
export async function cherryPickCommit(
  repoPath: string,
  commitHash: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["cherry-pick", commitHash]);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error cherry-picking commit:", error);
    throw error;
  }
}

/**
 * Revert a commit
 */
export async function revertCommit(
  repoPath: string,
  commitHash: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["revert", commitHash, "--no-edit"]);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error reverting commit:", error);
    throw error;
  }
}

/**
 * Abort revert operation
 */
export async function abortRevert(repoPath: string): Promise<{
  success: boolean;
  message: string;
}> {
  const git: SimpleGit = simpleGit(repoPath);
  const fs = require("fs");
  const path = require("path");

  try {
    const isRevertInProgress = (() => {
      try {
        const gitDir = path.join(repoPath, ".git");

        const revertHeadPath = path.join(gitDir, "REVERT_HEAD");
        if (!fs.existsSync(revertHeadPath)) {
          return false;
        }

        const sequencerDir = path.join(gitDir, "sequencer");
        if (!fs.existsSync(sequencerDir)) {
          return false;
        }

        return true;
      } catch (err) {
        return false;
      }
    })();

    if (!isRevertInProgress) {
      return {
        success: false,
        message: "No revert in progress",
      };
    }

    await git.raw(["revert", "--abort"]);
    gitCache.invalidate(repoPath);

    return {
      success: true,
      message: "Revert aborted successfully",
    };
  } catch (error: any) {
    console.error("Error aborting revert:", error);
    throw new Error(`Failed to abort revert: ${error.message}`);
  }
}

/**
 * Continue revert operation
 */
export async function continueRevert(repoPath: string): Promise<{
  success: boolean;
  message: string;
  hasConflicts?: boolean;
  conflictedFiles?: string[];
}> {
  const git: SimpleGit = simpleGit(repoPath);
  const fs = require("fs");
  const path = require("path");

  try {
    const isRevertInProgress = (() => {
      try {
        const gitDir = path.join(repoPath, ".git");

        const revertHeadPath = path.join(gitDir, "REVERT_HEAD");
        if (!fs.existsSync(revertHeadPath)) {
          return false;
        }

        const sequencerDir = path.join(gitDir, "sequencer");
        if (!fs.existsSync(sequencerDir)) {
          return false;
        }

        return true;
      } catch (err) {
        return false;
      }
    })();

    if (!isRevertInProgress) {
      return {
        success: false,
        message: "No revert in progress",
      };
    }

    const conflictedFiles = (await git.status()).conflicted;

    if (conflictedFiles.length > 0) {
      return {
        success: false,
        message: "Cannot continue revert: conflicts still exist",
        hasConflicts: true,
        conflictedFiles,
      };
    }

    await git.raw(["revert", "--continue"]);
    gitCache.invalidate(repoPath);

    return {
      success: true,
      message: "Revert continued successfully",
    };
  } catch (error: any) {
    console.error("Error continuing revert:", error);
    throw new Error(`Failed to continue revert: ${error.message}`);
  }
}

/**
 * Checkout a specific commit (detached HEAD)
 */
export async function checkoutCommit(
  repoPath: string,
  commitHash: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.checkout(commitHash);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error checking out commit:", error);
    throw error;
  }
}
