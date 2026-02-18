import simpleGit, { SimpleGit } from "simple-git";
import { gitCache } from "../cache";
import { StashEntry, CommitFile } from "./types";

/**
 * Create a new stash
 */
export async function createStash(
  repoPath: string,
  message?: string,
  includeUntracked: boolean = false,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const args = ["stash", "push"];

    if (includeUntracked) {
      args.push("-u");
    }

    if (message) {
      args.push("-m", message);
    }

    await git.raw(args);
  } catch (error) {
    console.error("Error creating stash:", error);
    throw error;
  }
}

/**
 * Get list of all stashes
 */
export async function getStashList(repoPath: string): Promise<StashEntry[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const output = await git.raw([
      "stash",
      "list",
      "--format=%gD|%H|%gs|%gd|%ci|%cn",
    ]);

    if (!output || output.trim().length === 0) {
      return [];
    }

    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const stashes: StashEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split("|");
      if (parts.length < 6) continue;

      const [selector, hash, subject, _refName, date, author] = parts;

      let branch = "unknown";
      let message = subject;

      const wipMatch = subject.match(/^(?:WIP on|On) ([^:]+):/);
      if (wipMatch) {
        branch = wipMatch[1];
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
    console.error("Error getting stash list:", error);
    throw error;
  }
}

/**
 * Apply a stash by index (keeps the stash in the list)
 */
export async function applyStash(
  repoPath: string,
  index: number,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["stash", "apply", `stash@{${index}}`]);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error applying stash:", error);
    throw error;
  }
}

/**
 * Pop a stash by index (removes the stash from the list)
 */
export async function popStash(repoPath: string, index: number): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["stash", "pop", `stash@{${index}}`]);
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error popping stash:", error);
    throw error;
  }
}

/**
 * Drop (delete) a stash by index
 */
export async function dropStash(
  repoPath: string,
  index: number,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["stash", "drop", `stash@{${index}}`]);
  } catch (error) {
    console.error("Error dropping stash:", error);
    throw error;
  }
}

/**
 * Get diff of a stash
 */
export async function getStashDiff(
  repoPath: string,
  index: number,
): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const diff = await git.raw(["stash", "show", "-p", `stash@{${index}}`]);
    return diff;
  } catch (error) {
    console.error("Error getting stash diff:", error);
    throw error;
  }
}

/**
 * Get stash files (list of changed files in a stash)
 */
export async function getStashFiles(
  repoPath: string,
  index: number,
): Promise<CommitFile[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const output = await git.raw([
      "stash",
      "show",
      "--numstat",
      `stash@{${index}}`,
    ]);

    if (!output || output.trim().length === 0) {
      return [];
    }

    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const files: CommitFile[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;

      const [addStr, delStr, ...pathParts] = parts;
      const filePath = pathParts.join(" ");

      const additions = addStr === "-" ? 0 : parseInt(addStr, 10);
      const deletions = delStr === "-" ? 0 : parseInt(delStr, 10);

      let status: "added" | "modified" | "deleted" | "renamed" = "modified";
      if (additions > 0 && deletions === 0) {
        status = "added";
      } else if (additions === 0 && deletions > 0) {
        status = "deleted";
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
    console.error("Error getting stash files:", error);
    throw error;
  }
}

/**
 * Create a new branch from a stash
 */
export async function createBranchFromStash(
  repoPath: string,
  index: number,
  branchName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["stash", "branch", branchName, `stash@{${index}}`]);
  } catch (error) {
    console.error("Error creating branch from stash:", error);
    throw error;
  }
}

/**
 * Clear all stashes
 */
export async function clearAllStashes(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["stash", "clear"]);
  } catch (error) {
    console.error("Error clearing stashes:", error);
    throw error;
  }
}
