import simpleGit, { SimpleGit } from "simple-git";
import { gitCache } from "../cache";
import { BranchInfo, CommitInfo } from "./types";
import { hasCommits } from "./utils";

/**
 * Get list of branches with commit information
 */
export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  const cached = gitCache.get<BranchInfo[]>(repoPath, "branches");
  if (cached) return cached;

  try {
    const branchSummary = await git.branch();
    if (!(await hasCommits(git))) {
      return [];
    }

    // Get commit info for all branches in one go
    const logResult = await git.raw([
      "log",
      "--all",
      "--format=%H%x00%ad%x00%an%x00%s",
      "--date=iso",
      "-n",
      "1",
      "--branches",
    ]);

    // Parse commit info into a map
    const commitMap = new Map<
      string,
      { date: string; author: string; message: string }
    >();
    const logLines = logResult.split("\n").filter((line) => line.trim() !== "");

    for (const line of logLines) {
      const [hash, date, author, ...messageParts] = line.split("\x00");
      commitMap.set(hash, {
        date: date,
        author: author,
        message: messageParts.join("\x00"),
      });
    }

    // Map branches to BranchInfo
    const branches: BranchInfo[] = Object.entries(branchSummary.branches).map(
      ([name, branch]) => {
        const commitInfo = commitMap.get(branch.commit);
        return {
          name,
          commit: branch.commit,
          lastCommitDate: commitInfo?.date || "",
          lastCommitMessage: commitInfo?.message || "",
          author: commitInfo?.author || "",
        };
      },
    );

    gitCache.set(repoPath, "branches", branches, 30000);
    return branches;
  } catch (error) {
    console.error("Error getting branches:", error);
    throw error;
  }
}

/**
 * Checkout a branch
 */
export async function checkoutBranch(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  if (status.files.length > 0) {
    const error: any = new Error(
      "Cannot checkout: you have uncommitted changes. Please commit or stash them first.",
    );
    error.hasUncommittedChanges = true;
    error.modifiedFiles = status.files.map((f) => f.path);
    throw error;
  }

  let targetBranch = branchName;
  if (branchName.startsWith("remotes/")) {
    targetBranch = branchName.replace("remotes/", "");
  }

  if (targetBranch.includes("/")) {
    const parts = targetBranch.split("/");
    const localBranchName = parts[parts.length - 1];

    const branches = await git.branch();
    if (branches.all.includes(localBranchName)) {
      await git.checkout(localBranchName);
    } else {
      await git.checkout([
        "-b",
        localBranchName,
        "--track",
        branchName.startsWith("remotes/")
          ? branchName.substring(8)
          : branchName,
      ]);
    }
  } else {
    await git.checkout(targetBranch);
  }

  gitCache.invalidate(repoPath);
}

/**
 * Stash changes and then checkout a branch
 */
export async function stashAndCheckout(
  repoPath: string,
  branchName: string,
  stashMessage?: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  if (status.files.length === 0) {
    await checkoutBranch(repoPath, branchName);
    return;
  }

  try {
    const message =
      stashMessage || `Auto-stash before switching to ${branchName}`;

    // Create stash
    const args = ["stash", "push", "-u"];
    if (message) {
      args.push("-m", message);
    }
    await git.raw(args);

    let targetBranch = branchName;
    if (branchName.startsWith("remotes/")) {
      targetBranch = branchName.replace("remotes/", "");
    }

    if (targetBranch.includes("/")) {
      const parts = targetBranch.split("/");
      const localBranchName = parts[parts.length - 1];

      const branches = await git.branch();
      if (branches.all.includes(localBranchName)) {
        await git.checkout(localBranchName);
      } else {
        await git.checkout([
          "-b",
          localBranchName,
          "--track",
          branchName.startsWith("remotes/")
            ? branchName.substring(8)
            : branchName,
        ]);
      }
    } else {
      await git.checkout(targetBranch);
    }

    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error during stash and checkout:", error);
    throw error;
  }
}

/**
 * Discard all changes and then checkout a branch
 */
export async function discardAndCheckout(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.reset(["--hard"]);
    await git.clean("f", ["-d"]);

    let targetBranch = branchName;
    if (branchName.startsWith("remotes/")) {
      targetBranch = branchName.replace("remotes/", "");
    }

    if (targetBranch.includes("/")) {
      const parts = targetBranch.split("/");
      const localBranchName = parts[parts.length - 1];

      const branches = await git.branch();
      if (branches.all.includes(localBranchName)) {
        await git.checkout(localBranchName);
      } else {
        await git.checkout([
          "-b",
          localBranchName,
          "--track",
          branchName.startsWith("remotes/")
            ? branchName.substring(8)
            : branchName,
        ]);
      }
    } else {
      await git.checkout(targetBranch);
    }

    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error during discard and checkout:", error);
    throw error;
  }
}

/**
 * Merge a branch into the current branch
 */
export async function mergeBranch(
  repoPath: string,
  branchName: string,
  mergeMode: "auto" | "no-ff" | "ff-only" = "no-ff",
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  const status = await git.status();
  if (status.files.length > 0) {
    throw new Error(
      "Cannot merge: you have uncommitted changes. Please commit or stash them first.",
    );
  }

  const branchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  if (!currentBranch) {
    throw new Error("Cannot merge: no current branch");
  }

  if (branchName === currentBranch) {
    throw new Error("Cannot merge: branch is already the current branch");
  }

  let targetBranch = branchName;
  if (branchName.startsWith("remotes/")) {
    targetBranch = branchName.replace("remotes/", "");
  }

  try {
    const mergeOptions: string[] = [targetBranch];

    if (mergeMode === "no-ff") {
      mergeOptions.push("--no-ff", "--no-edit");
    } else if (mergeMode === "ff-only") {
      mergeOptions.push("--ff-only");
    } else {
      mergeOptions.push("--no-edit");
    }

    await git.merge(mergeOptions);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    gitCache.invalidate(repoPath);

    if (
      error.message &&
      (error.message.includes("CONFLICT") ||
        error.message.includes("Automatic merge failed"))
    ) {
      throw new Error(
        "Merge conflict detected. Please resolve conflicts manually.",
      );
    }

    if (
      error.message &&
      error.message.includes("Not possible to fast-forward")
    ) {
      throw new Error(
        "Cannot fast-forward merge. Use a different merge mode or resolve conflicts manually.",
      );
    }

    throw error;
  }
}

/**
 * Create a new branch
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  startPoint?: string,
  switchAfterCreate: boolean = false,
  pushAfterCreate: boolean = false,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  if (!branchName || branchName.trim() === "") {
    throw new Error("Branch name cannot be empty");
  }

  const branches = await git.branch();
  if (branches.all.includes(branchName)) {
    throw new Error(`Branch "${branchName}" already exists`);
  }

  if (startPoint) {
    await git.branch([branchName, startPoint]);
  } else {
    await git.branch([branchName]);
  }

  if (switchAfterCreate) {
    await git.checkout(branchName);
  }

  if (pushAfterCreate) {
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some((r) => r.name === "origin");
    if (hasOrigin) {
      if (switchAfterCreate) {
        await git.push(["-u", "origin", branchName]);
      } else {
        await git.push(["origin", branchName]);
      }
    } else {
      throw new Error("Cannot push: no origin remote configured");
    }
  }

  gitCache.invalidate(repoPath);
}

/**
 * Delete a branch
 */
export async function deleteBranch(
  repoPath: string,
  branchName: string,
  force: boolean = false,
): Promise<{ deleted: boolean; warning?: string }> {
  const git: SimpleGit = simpleGit(repoPath);

  const branchSummary = await git.branch();
  if (branchSummary.current === branchName) {
    throw new Error("Cannot delete the currently checked out branch");
  }

  if (!force) {
    try {
      const mergedBranches = await git.raw(["branch", "--merged"]);
      const isMerged = mergedBranches
        .split("\n")
        .some(
          (line) =>
            line.trim() === branchName || line.trim() === `* ${branchName}`,
        );

      if (!isMerged) {
        return {
          deleted: false,
          warning:
            "Branch is not fully merged. Use force delete to remove it anyway.",
        };
      }
    } catch (error) {
      console.error("Error checking if branch is merged:", error);
    }
  }

  try {
    await git.branch([force ? "-D" : "-d", branchName]);
    gitCache.invalidate(repoPath);
    return { deleted: true };
  } catch (error: any) {
    throw new Error(`Failed to delete branch: ${error.message}`);
  }
}

/**
 * Delete a remote branch
 */
export async function deleteRemoteBranch(
  repoPath: string,
  remoteName: string,
  branchName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.push([remoteName, "--delete", branchName]);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    throw new Error(`Failed to delete remote branch: ${error.message}`);
  }
}

/**
 * Rename a branch
 */
export async function renameBranch(
  repoPath: string,
  oldName: string,
  newName: string,
  renameRemote: boolean = false,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  if (!newName || newName.trim() === "") {
    throw new Error("New branch name cannot be empty");
  }

  const branches = await git.branch();
  if (branches.all.includes(newName)) {
    throw new Error(`Branch "${newName}" already exists`);
  }

  const isCurrentBranch = branches.current === oldName;

  if (isCurrentBranch) {
    await git.branch(["-m", newName]);
  } else {
    await git.branch(["-m", oldName, newName]);
  }

  if (renameRemote) {
    try {
      const trackingInfo = await git.raw([
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        `${oldName}@{u}`,
      ]);
      if (trackingInfo && trackingInfo.trim()) {
        const [remoteName, remoteBranch] = trackingInfo.trim().split("/");

        await git.push([remoteName, "--delete", remoteBranch]);
        await git.push(["-u", remoteName, newName]);
      }
    } catch (error) {
      console.warn(
        "Remote branch does not exist or could not be renamed:",
        error,
      );
    }
  }

  gitCache.invalidate(repoPath);
}

/**
 * Set upstream branch
 */
export async function setUpstreamBranch(
  repoPath: string,
  localBranch: string,
  remoteName: string,
  remoteBranch: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.branch([
      "--set-upstream-to",
      `${remoteName}/${remoteBranch}`,
      localBranch,
    ]);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    throw new Error(`Failed to set upstream branch: ${error.message}`);
  }
}

/**
 * Unset upstream branch
 */
export async function unsetUpstreamBranch(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.branch(["--unset-upstream", branchName]);
    gitCache.invalidate(repoPath);
  } catch (error: any) {
    throw new Error(`Failed to unset upstream branch: ${error.message}`);
  }
}

/**
 * Compare two branches
 */
export async function compareBranches(
  repoPath: string,
  baseBranch: string,
  compareBranch: string,
): Promise<{
  ahead: number;
  behind: number;
  files: {
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
}> {
  const git: SimpleGit = simpleGit(repoPath);

  const revList = await git.raw([
    "rev-list",
    "--left-right",
    "--count",
    `${baseBranch}...${compareBranch}`,
  ]);
  const [behind, ahead] = revList.trim().split("\t").map(Number);

  const diffSummary = await git.diffSummary([baseBranch, compareBranch]);

  const files = diffSummary.files.map((file) => ({
    path: file.file,
    status: file.binary ? "binary" : "modified",
    additions: "insertions" in file ? file.insertions : 0,
    deletions: "deletions" in file ? file.deletions : 0,
  }));

  return { ahead, behind, files };
}
