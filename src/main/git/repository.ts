import simpleGit, { SimpleGit, BranchSummary, StatusResult } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { gitCache } from "../cache";
import { RepositoryInfo } from "./types";
import { getExistingUpstreamRef } from "./utils";

/**
 * Scan a directory recursively for Git repositories
 */
export async function scanForRepositories(
  folderPath: string,
): Promise<string[]> {
  const repositories: string[] = [];

  async function scan(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      // Check if current directory is a git repository
      if (
        entries.some((entry) => entry.name === ".git" && entry.isDirectory())
      ) {
        repositories.push(dir);
        return; // Don't scan subdirectories of a git repo
      }

      // Scan subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
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

/**
 * Get detailed repository information
 */
export async function getRepositoryInfo(
  repoPath: string,
  forceFetch: boolean = false,
): Promise<RepositoryInfo> {
  const cached = gitCache.get<RepositoryInfo>(repoPath, "repoInfo");

  const git: SimpleGit = simpleGit(repoPath);

  try {
    const shouldFetch = forceFetch || !cached;
    if (shouldFetch) {
      try {
        await git.fetch();
      } catch (error) {
        console.warn(
          "Fetch failed in getRepositoryInfo (continuing with local info):",
          error,
        );
      }
    }

    const branchSummary: BranchSummary = await git.branch();
    let currentBranch = branchSummary.current;

    // Check if we're in a rebase
    const rebaseMergePath = path.join(repoPath, ".git", "rebase-merge");
    const rebaseApplyPath = path.join(repoPath, ".git", "rebase-apply");
    const isRebasing =
      fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath);

    if (isRebasing && (!currentBranch || currentBranch === "HEAD")) {
      try {
        const headNamePath = path.join(rebaseMergePath, "head-name");
        if (fs.existsSync(headNamePath)) {
          const headName = fs.readFileSync(headNamePath, "utf-8").trim();
          currentBranch = headName.replace(/^refs\/heads\//, "");
        }
      } catch (err) {
        // Ignore errors reading rebase state
      }
    }

    const branches = Object.keys(branchSummary.branches);
    const status: StatusResult = await git.status();
    const remotes = await git.getRemotes(true);
    const preferredRemote =
      remotes.find((remote) => remote.name === "origin")?.name ||
      remotes[0]?.name ||
      null;

    let incomingCommits = 0;
    let outgoingCommits = 0;

    try {
      if (currentBranch) {
        const upstream = await getExistingUpstreamRef(
          git,
          currentBranch,
          status.tracking,
          preferredRemote,
        );

        if (upstream) {
          const revList = await git.raw([
            "rev-list",
            "--left-right",
            "--count",
            `${currentBranch}...${upstream}`,
          ]);
          const [outgoing, incoming] = revList.trim().split("\t").map(Number);
          outgoingCommits = outgoing || 0;
          incomingCommits = incoming || 0;
        } else if (remotes.length > 0) {
          const revList = await git.raw([
            "rev-list",
            "--count",
            currentBranch,
            "--not",
            "--remotes",
          ]);
          outgoingCommits = Number(revList.trim()) || 0;
        } else {
          const revList = await git.raw([
            "rev-list",
            "--count",
            currentBranch,
          ]);
          outgoingCommits = Number(revList.trim()) || 0;
        }
      }
    } catch (error) {
      console.log("No remote tracking branch found");
    }

    const repoInfo: RepositoryInfo = {
      path: repoPath,
      name: path.basename(repoPath),
      currentBranch,
      branches,
      incomingCommits,
      outgoingCommits,
      hasRemotes: remotes.length > 0,
      preferredRemote,
      isRebasing,
      status: {
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: status.renamed.map((r) => (typeof r === "string" ? r : r.to)),
        conflicted: status.conflicted,
        staged: status.staged,
        ahead: status.ahead,
        behind: status.behind,
        current: status.current,
        tracking: status.tracking,
      },
    };

    gitCache.set(repoPath, "repoInfo", repoInfo);

    return repoInfo;
  } catch (error) {
    console.error("Error getting repository info:", error);
    throw error;
  }
}
