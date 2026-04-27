import simpleGit, { SimpleGit } from "simple-git";
import { GitGraphRow } from "./types";
import { hasCommits } from "./utils";

/**
 * Get git graph visualization
 */
export async function getGitGraph(
  repoPath: string,
  branch?: string,
): Promise<GitGraphRow[]> {
  const git: SimpleGit = simpleGit(repoPath);
  if (!(await hasCommits(git))) {
    return [];
  }

  const normalizedBranch = branch?.startsWith("remotes/")
    ? branch.replace("remotes/", "")
    : branch;

  const args = [
    "log",
    "--no-color",
    "--graph",
    "--decorate=short",
    "--oneline",
    "--date-order",
    "--max-count=200",
  ];

  if (normalizedBranch && normalizedBranch.trim().length > 0) {
    args.push(normalizedBranch);
  } else {
    args.push("--all");
  }

  const output = await git.raw(args);
  const lines = output
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0);

  const rows: GitGraphRow[] = [];
  const hashRegex = /[0-9a-f]{7,40}/i;

  for (const line of lines) {
    const match = line.match(hashRegex);
    if (!match || match.index === undefined) continue;

    const hash = match[0];
    const idx = match.index;
    const graph = line.slice(0, idx);
    const message = line.slice(idx + hash.length).trimStart();

    rows.push({ graph, hash, message });
  }

  return rows;
}
