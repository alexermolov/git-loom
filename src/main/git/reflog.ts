import simpleGit, { SimpleGit } from "simple-git";
import { ReflogEntry } from "./types";
import { hasCommits } from "./utils";

/**
 * Get reflog entries
 */
export async function getReflog(
  repoPath: string,
  ref: string = "HEAD",
  maxCount: number = 100,
): Promise<ReflogEntry[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    if (!(await hasCommits(git))) {
      return [];
    }

    // Format: %gD|%H|%gn|%gs|%ci|%cn
    // %gD - reflog selector (HEAD@{0})
    // %H - commit hash
    // %gn - reflog ref name
    // %gs - reflog subject (action message)
    // %ci - committer date ISO
    // %cn - committer name
    const args = [
      "reflog",
      ref,
      `--max-count=${maxCount}`,
      "--format=%gD|%H|%gn|%gs|%ci|%cn",
      "--date=iso",
    ];

    const output = await git.raw(args);
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const entries: ReflogEntry[] = [];

    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length < 6) continue;

      const [selector, hash, refName, subject, date, author] = parts;

      // Parse action from subject with enhanced detection
      let action = "unknown";
      const subjectLower = subject.toLowerCase();

      // Check for specific patterns - order matters (most specific first)
      if (
        subjectLower.match(/^merge\b/i) ||
        subjectLower.match(/merge.*into/i) ||
        subjectLower.includes("merge branch")
      ) {
        action = "merge";
      } else if (
        subjectLower.match(/pull.*into/i) ||
        subjectLower.includes("pull origin") ||
        subjectLower.includes("fast-forward")
      ) {
        action = "pull";
      } else if (
        subjectLower.match(/^rebase/i) ||
        subjectLower.includes("rebase -i") ||
        subjectLower.includes("rebase (start)") ||
        subjectLower.includes("rebase (finish)") ||
        subjectLower.includes("rebase (continue)")
      ) {
        action = "rebase";
      } else if (
        subjectLower.match(/commit \(amend\)/i) ||
        subjectLower.includes("amend")
      ) {
        action = "amend";
      } else if (
        subjectLower.match(/^commit:/i) ||
        subjectLower.match(/^commit \(/i) ||
        subjectLower.match(/^commit\b/i)
      ) {
        action = "commit";
      } else if (
        subjectLower.match(/^checkout:/i) ||
        subjectLower.includes("moving from") ||
        subjectLower.match(/checkout.*to/i)
      ) {
        action = "checkout";
      } else if (
        subjectLower.match(/^reset:/i) ||
        subjectLower.includes("reset --") ||
        subjectLower.match(/moving to \w{7,}/i)
      ) {
        action = "reset";
      } else if (
        subjectLower.match(/^clone/i) ||
        subjectLower.includes("from remote")
      ) {
        action = "clone";
      } else if (
        subjectLower.match(/^fetch/i) ||
        subjectLower.includes("fetch origin")
      ) {
        action = "fetch";
      } else if (
        subjectLower.match(/cherry.?pick/i) ||
        subjectLower.includes("pick")
      ) {
        action = "cherry-pick";
      } else if (
        subjectLower.match(/^push/i) ||
        subjectLower.includes("update by push")
      ) {
        action = "push";
      } else if (
        subjectLower.match(/^branch:/i) ||
        subjectLower.includes("created") ||
        subjectLower.includes("branch: created")
      ) {
        action = "branch";
      } else if (subjectLower.match(/^stash/i)) {
        action = "stash";
      } else if (subjectLower.match(/^initial commit/i)) {
        action = "initial";
      } else {
        // Fall back to extracting first word before colon
        const actionMatch = subject.match(/^(\w+):/);
        if (actionMatch) {
          action = actionMatch[1];
        }
      }

      entries.push({
        selector,
        hash,
        refName: refName || ref,
        action,
        message: subject,
        date,
        author,
      });
    }

    return entries;
  } catch (error) {
    console.error("Error getting reflog:", error);
    throw error;
  }
}
