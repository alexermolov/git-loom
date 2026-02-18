import simpleGit, { SimpleGit, BranchSummary } from "simple-git";
import { gitCache } from "../cache";
import { RemoteInfo, PushRepositoryOptions } from "./types";

/**
 * Pull repository (fast-forward only)
 */
export async function pullRepository(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  const branchSummary: BranchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error("Cannot pull: no current branch");
  }

  if (status.tracking) {
    await git.pull(["--ff-only"]);
  } else {
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === "origin");
    if (!hasOrigin) {
      throw new Error("Cannot pull: no tracking branch and no origin remote");
    }
    await git.pull("origin", currentBranch, ["--ff-only"]);
  }

  gitCache.invalidate(repoPath);
}

/**
 * Push repository with optional force
 */
export async function pushRepository(
  repoPath: string,
  options: PushRepositoryOptions = {},
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  const branchSummary: BranchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error("Cannot push: no current branch");
  }

  const forceFlag = options.forceWithLease
    ? "--force-with-lease"
    : options.force
      ? "--force"
      : null;

  if (status.tracking) {
    if (forceFlag) {
      await git.raw(["push", forceFlag]);
    } else {
      await git.push();
    }
  } else {
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === "origin");
    if (!hasOrigin) {
      throw new Error("Cannot push: no tracking branch and no origin remote");
    }
    if (forceFlag) {
      await git.raw(["push", forceFlag, "-u", "origin", currentBranch]);
    } else {
      await git.push(["-u", "origin", currentBranch]);
    }
  }

  gitCache.invalidate(repoPath);
}

/**
 * Get all remotes for a repository
 */
export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const remotes = await git.getRemotes(true);
    const remoteInfos: RemoteInfo[] = [];

    for (const remote of remotes) {
      const branches: string[] = [];
      try {
        const branchResult = await git.raw([
          "branch",
          "-r",
          "--list",
          `${remote.name}/*`,
        ]);
        if (branchResult.trim()) {
          branches.push(
            ...branchResult
              .trim()
              .split("\n")
              .map((b) => b.trim().replace(`${remote.name}/`, ""))
              .filter((b) => b && b !== "HEAD"),
          );
        }
      } catch (error) {
        console.warn(
          `Error getting branches for remote ${remote.name}:`,
          error,
        );
      }

      remoteInfos.push({
        name: remote.name,
        fetchUrl: remote.refs.fetch || "",
        pushUrl: remote.refs.push || remote.refs.fetch || "",
        branches,
      });
    }

    return remoteInfos;
  } catch (error) {
    console.error("Error getting remotes:", error);
    throw error;
  }
}

/**
 * Add a new remote
 */
export async function addRemote(
  repoPath: string,
  name: string,
  url: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      throw new Error(
        "Remote name can only contain letters, numbers, dots, underscores, and hyphens",
      );
    }

    const remotes = await git.getRemotes();
    if (remotes.some((r) => r.name === name)) {
      throw new Error(`Remote '${name}' already exists`);
    }

    await git.addRemote(name, url);
  } catch (error) {
    console.error("Error adding remote:", error);
    throw error;
  }
}

/**
 * Remove a remote
 */
export async function removeRemote(
  repoPath: string,
  name: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const remotes = await git.getRemotes();
    if (!remotes.some((r) => r.name === name)) {
      throw new Error(`Remote '${name}' does not exist`);
    }

    await git.removeRemote(name);
  } catch (error) {
    console.error("Error removing remote:", error);
    throw error;
  }
}

/**
 * Rename a remote
 */
export async function renameRemote(
  repoPath: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    if (!/^[a-zA-Z0-9._-]+$/.test(newName)) {
      throw new Error(
        "Remote name can only contain letters, numbers, dots, underscores, and hyphens",
      );
    }

    const remotes = await git.getRemotes();
    if (!remotes.some((r) => r.name === oldName)) {
      throw new Error(`Remote '${oldName}' does not exist`);
    }

    if (remotes.some((r) => r.name === newName)) {
      throw new Error(`Remote '${newName}' already exists`);
    }

    await git.raw(["remote", "rename", oldName, newName]);
  } catch (error) {
    console.error("Error renaming remote:", error);
    throw error;
  }
}

/**
 * Update remote URL
 */
export async function setRemoteUrl(
  repoPath: string,
  name: string,
  url: string,
  isPushUrl: boolean = false,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const remotes = await git.getRemotes();
    if (!remotes.some((r) => r.name === name)) {
      throw new Error(`Remote '${name}' does not exist`);
    }

    const args = ["remote", "set-url"];
    if (isPushUrl) {
      args.push("--push");
    }
    args.push(name, url);

    await git.raw(args);
  } catch (error) {
    console.error("Error setting remote URL:", error);
    throw error;
  }
}

/**
 * Fetch from a specific remote
 */
export async function fetchRemote(
  repoPath: string,
  remoteName: string,
  prune: boolean = false,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const options: string[] = [remoteName];
    if (prune) {
      options.push("--prune");
    }

    await git.fetch(options);

    gitCache.invalidate(repoPath, "branches");
    gitCache.invalidate(repoPath, "commitDetails");
  } catch (error) {
    console.error("Error fetching from remote:", error);
    throw error;
  }
}

/**
 * Prune remote-tracking branches
 */
export async function pruneRemote(
  repoPath: string,
  remoteName: string,
): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const result = await git.raw(["remote", "prune", remoteName, "--dry-run"]);
    const prunedBranches: string[] = [];

    if (result.trim()) {
      const lines = result.split("\n");
      for (const line of lines) {
        const match = line.match(/\* \[would prune\] (.+)/);
        if (match) {
          prunedBranches.push(match[1]);
        }
      }
    }

    if (prunedBranches.length > 0) {
      await git.raw(["remote", "prune", remoteName]);
      gitCache.invalidate(repoPath, "branches");
    }

    return prunedBranches;
  } catch (error) {
    console.error("Error pruning remote:", error);
    throw error;
  }
}

/**
 * Set upstream branch for current branch
 */
export async function setUpstream(
  repoPath: string,
  remoteName: string,
  remoteBranch: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw([
      "branch",
      "--set-upstream-to",
      `${remoteName}/${remoteBranch}`,
    ]);
  } catch (error) {
    console.error("Error setting upstream:", error);
    throw error;
  }
}

/**
 * Get upstream branch for current branch
 */
export async function getUpstream(
  repoPath: string,
): Promise<{ remote: string; branch: string } | null> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const result = await git.raw([
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);
    const upstream = result.trim();

    if (!upstream || upstream === "@{upstream}") {
      return null;
    }

    const [remote, ...branchParts] = upstream.split("/");
    return {
      remote,
      branch: branchParts.join("/"),
    };
  } catch (error) {
    return null;
  }
}
