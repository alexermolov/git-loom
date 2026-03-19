import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs/promises";
import * as path from "path";
import type {
  FileHistoryEntry,
  FileHistoryTimeline,
  FileComparisonResult,
  FileVersionContent,
  FileStatistics,
  AuthorContribution,
} from "./types";

type InternalFileHistoryEntry = FileHistoryEntry & {
  pathAtCommit: string;
};

type ParsedHistoryData = {
  entries: InternalFileHistoryEntry[];
  renames: Array<{ from: string; to: string; hash: string; date: string }>;
};

const COMMIT_MARKER = "__GITLOOM_FILE_HISTORY_COMMIT__";

function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function parseCommitMetadata(line: string): {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  authorEmail: string;
  message: string;
} {
  const [hash, shortHash, date, author, authorEmail, ...messageParts] =
    line.split("|");

  return {
    hash,
    shortHash,
    date,
    author,
    authorEmail,
    message: messageParts.join("|"),
  };
}

function parseCommitSummary(line: string): {
  hash: string;
  date: string;
  author: string;
  message: string;
} {
  const [hash, date, author, ...messageParts] = line.split("|");

  return {
    hash,
    date,
    author,
    message: messageParts.join("|"),
  };
}

function parseNameStatusLine(line: string): {
  status: FileHistoryEntry["status"];
  pathAtCommit?: string;
  oldPath?: string;
} | null {
  const parts = line.split("\t");
  if (parts.length < 2) {
    return null;
  }

  const statusCode = parts[0][0];

  switch (statusCode) {
    case "A":
      return {
        status: "added",
        pathAtCommit: normalizeGitPath(parts[1]),
      };
    case "D":
      return {
        status: "deleted",
        pathAtCommit: normalizeGitPath(parts[1]),
      };
    case "R":
    case "C": {
      const oldPath = normalizeGitPath(parts[1]);
      const newPath = normalizeGitPath(parts[2] || parts[1]);

      return {
        status: "renamed",
        pathAtCommit: newPath,
        oldPath,
      };
    }
    case "M":
    default:
      return {
        status: "modified",
        pathAtCommit: normalizeGitPath(parts[1]),
      };
  }
}

function parseNumstatMap(output: string): Map<string, { additions: number; deletions: number }> {
  const statsByHash = new Map<string, { additions: number; deletions: number }>();
  const lines = output.split("\n");
  let currentHash: string | null = null;
  let expectingHash = false;

  for (const line of lines) {
    if (line === COMMIT_MARKER) {
      currentHash = null;
      expectingHash = true;
      continue;
    }

    if (expectingHash) {
      currentHash = line.trim() || null;
      expectingHash = false;
      continue;
    }

    if (!line.trim() || !currentHash) {
      continue;
    }

    const parts = line.split("\t");
    if (parts.length < 3) {
      continue;
    }

    const additions = Number.parseInt(parts[0], 10);
    const deletions = Number.parseInt(parts[1], 10);
    const currentStats = statsByHash.get(currentHash) || {
      additions: 0,
      deletions: 0,
    };

    currentStats.additions += Number.isFinite(additions) ? additions : 0;
    currentStats.deletions += Number.isFinite(deletions) ? deletions : 0;

    statsByHash.set(currentHash, currentStats);
  }

  return statsByHash;
}

async function loadParsedHistory(
  git: SimpleGit,
  filePath: string,
  maxCount?: number,
): Promise<ParsedHistoryData> {
  const normalizedPath = normalizeGitPath(filePath);
  const historyArgs = [
    "log",
    "--follow",
    "--name-status",
    `--format=${COMMIT_MARKER}%n%H|%h|%ad|%an|%ae|%s`,
    "--date=iso",
  ];
  const numstatArgs = [
    "log",
    "--follow",
    "--numstat",
    `--format=${COMMIT_MARKER}%n%H`,
    "--date=iso",
  ];

  if (maxCount) {
    historyArgs.push(`-${maxCount}`);
    numstatArgs.push(`-${maxCount}`);
  }

  historyArgs.push("--", normalizedPath);
  numstatArgs.push("--", normalizedPath);

  const [historyOutput, numstatOutput] = await Promise.all([
    git.raw(historyArgs),
    git.raw(numstatArgs),
  ]);

  const statsByHash = parseNumstatMap(numstatOutput);
  const entries: InternalFileHistoryEntry[] = [];
  const renames: Array<{ from: string; to: string; hash: string; date: string }> = [];
  const lines = historyOutput.split("\n");

  let currentMetadata:
    | {
        hash: string;
        shortHash: string;
        date: string;
        author: string;
        authorEmail: string;
        message: string;
      }
    | null = null;
  let expectingMetadata = false;
  let currentPath = normalizedPath;

  for (const line of lines) {
    if (line === COMMIT_MARKER) {
      currentMetadata = null;
      expectingMetadata = true;
      continue;
    }

    if (expectingMetadata) {
      if (!line.trim()) {
        continue;
      }

      currentMetadata = parseCommitMetadata(line);
      expectingMetadata = false;
      continue;
    }

    if (!line.trim() || !currentMetadata) {
      continue;
    }

    const parsedStatus = parseNameStatusLine(line);
    if (!parsedStatus) {
      continue;
    }

    const stats = statsByHash.get(currentMetadata.hash) || {
      additions: 0,
      deletions: 0,
    };
    const pathAtCommit = parsedStatus.pathAtCommit || currentPath;

    entries.push({
      ...currentMetadata,
      status: parsedStatus.status,
      additions: stats.additions,
      deletions: stats.deletions,
      oldPath: parsedStatus.oldPath,
      pathAtCommit,
    });

    if (parsedStatus.status === "renamed" && parsedStatus.oldPath) {
      renames.push({
        from: parsedStatus.oldPath,
        to: pathAtCommit,
        hash: currentMetadata.hash,
        date: currentMetadata.date,
      });
      currentPath = parsedStatus.oldPath;
    } else {
      currentPath = pathAtCommit;
    }

    currentMetadata = null;
  }

  if (entries.length === 0) {
    throw new Error(`No file history found for ${filePath}`);
  }

  const oldestEntry = entries[entries.length - 1];
  if (oldestEntry.status === "modified") {
    oldestEntry.status = "added";
  }

  return {
    entries,
    renames: renames.reverse(),
  };
}

async function resolveFilePathAtCommit(
  git: SimpleGit,
  filePath: string,
  commitHash: string,
): Promise<string> {
  const parsedHistory = await loadParsedHistory(git, filePath);
  const matchingEntry = parsedHistory.entries.find(
    (entry) => entry.hash === commitHash,
  );

  if (!matchingEntry) {
    return normalizeGitPath(filePath);
  }

  return matchingEntry.pathAtCommit;
}

async function getCommitInfo(
  git: SimpleGit,
  commitHash: string,
): Promise<{ hash: string; date: string; author: string; message: string }> {
  const output = await git.raw([
    "show",
    "-s",
    "--format=%H|%ad|%an|%s",
    "--date=iso",
    commitHash,
  ]);

  return parseCommitSummary(output.trim());
}

/**
 * Get file history timeline with all commits that modified the file
 * Tracks file across renames
 */
export async function getFileHistory(
  repoPath: string,
  filePath: string,
  maxCount?: number,
): Promise<FileHistoryTimeline> {
  const git: SimpleGit = simpleGit(repoPath);
  const { entries, renames } = await loadParsedHistory(git, filePath, maxCount);

  return {
    filePath: normalizeGitPath(filePath),
    currentPath: entries[0].pathAtCommit,
    totalCommits: entries.length,
    firstCommit: entries[entries.length - 1],
    lastCommit: entries[0],
    history: entries.map(({ pathAtCommit, ...entry }) => entry),
    renames,
  };
}

/**
 * Compare file content between two commits
 */
export async function compareFileAcrossCommits(
  repoPath: string,
  filePath: string,
  fromCommitHash: string,
  toCommitHash: string,
): Promise<FileComparisonResult> {
  const git: SimpleGit = simpleGit(repoPath);
  const [fromCommit, toCommit, fromPathAtCommit, toPathAtCommit] =
    await Promise.all([
      getCommitInfo(git, fromCommitHash),
      getCommitInfo(git, toCommitHash),
      resolveFilePathAtCommit(git, filePath, fromCommitHash),
      resolveFilePathAtCommit(git, filePath, toCommitHash),
    ]);

  const diffOutput = await git.raw([
    "diff",
    "--no-ext-diff",
    `${fromCommitHash}:${fromPathAtCommit}`,
    `${toCommitHash}:${toPathAtCommit}`,
  ]);

  // Count additions and deletions
  let additions = 0;
  let deletions = 0;
  const diffLines = diffOutput.split("\n");

  for (const line of diffLines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  return {
    filePath: normalizeGitPath(filePath),
    fromCommit,
    toCommit,
    diff: diffOutput,
    additions,
    deletions,
    changedLines: additions + deletions,
  };
}

/**
 * Get file content at specific commit
 */
export async function getFileAtCommit(
  repoPath: string,
  filePath: string,
  commitHash: string,
): Promise<FileVersionContent> {
  const git: SimpleGit = simpleGit(repoPath);
  const pathAtCommit = await resolveFilePathAtCommit(git, filePath, commitHash);
  const [content, commitInfo] = await Promise.all([
    git.show([`${commitHash}:${pathAtCommit}`]),
    getCommitInfo(git, commitHash),
  ]);

  return {
    filePath: pathAtCommit,
    commitHash,
    content,
    date: commitInfo.date,
    author: commitInfo.author,
    message: commitInfo.message,
    size: Buffer.byteLength(content, "utf8"),
  };
}

/**
 * Restore file to specific commit version
 */
export async function restoreFileFromCommit(
  repoPath: string,
  filePath: string,
  commitHash: string,
): Promise<void> {
  const version = await getFileAtCommit(repoPath, filePath, commitHash);
  const fullPath = path.join(repoPath, filePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, version.content, "utf8");
}

/**
 * Get file statistics and author contributions
 */
export async function getFileStatistics(
  repoPath: string,
  filePath: string,
): Promise<FileStatistics> {
  const git: SimpleGit = simpleGit(repoPath);

  // Get full history with detailed stats
  const logOutput = await git.raw([
    "log",
    "--follow",
    "--numstat",
    "--pretty=format:%H|%ad|%an|%ae|%s",
    "--date=iso",
    "--",
    normalizeGitPath(filePath),
  ]);

  const authorMap = new Map<
    string,
    {
      email: string;
      commits: number;
      additions: number;
      deletions: number;
      firstCommit: string;
      lastCommit: string;
    }
  >();

  const monthlyActivity = new Map<
    string,
    { commits: number; additions: number; deletions: number }
  >();

  let totalCommits = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;
  let firstCommitDate = "";
  let lastCommitDate = "";

  const lines = logOutput.trim().split("\n");
  let currentCommit: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("|")) {
      // Commit info line
      const [hash, date, author, email, ...messageParts] = line.split("|");
      const message = messageParts.join("|");
      currentCommit = { hash, date, author, email, message };

      if (!lastCommitDate) {
        lastCommitDate = date;
      }
      firstCommitDate = date;

      totalCommits++;

      // Track author
      if (!authorMap.has(author)) {
        authorMap.set(author, {
          email,
          commits: 0,
          additions: 0,
          deletions: 0,
          firstCommit: date,
          lastCommit: date,
        });
      }

      const authorData = authorMap.get(author)!;
      authorData.commits++;
      authorData.firstCommit = date;

      // Track monthly activity
      const month = date.substring(0, 7); // YYYY-MM
      if (!monthlyActivity.has(month)) {
        monthlyActivity.set(month, { commits: 0, additions: 0, deletions: 0 });
      }
      monthlyActivity.get(month)!.commits++;
    } else if (line.trim() === "") {
      continue;
    } else if (currentCommit) {
      // Numstat line
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const [addStr, delStr] = parts;
        const additions = parseInt(addStr) || 0;
        const deletions = parseInt(delStr) || 0;

        totalAdditions += additions;
        totalDeletions += deletions;

        // Add to author stats
        const authorData = authorMap.get(currentCommit.author)!;
        authorData.additions += additions;
        authorData.deletions += deletions;

        // Add to monthly stats
        const month = currentCommit.date.substring(0, 7);
        const monthData = monthlyActivity.get(month)!;
        monthData.additions += additions;
        monthData.deletions += deletions;
      }
      currentCommit = null;
    }
  }

  if (totalCommits === 0) {
    throw new Error(`No file statistics found for ${filePath}`);
  }

  // Calculate age in days
  const firstDate = new Date(firstCommitDate || lastCommitDate);
  const lastDate = new Date(lastCommitDate || firstCommitDate);
  const ageInDays = Math.max(
    0,
    Math.ceil(
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  // Convert author map to array with percentages
  const totalChanges = totalAdditions + totalDeletions;
  const authors: AuthorContribution[] = Array.from(authorMap.entries())
    .map(([author, data]) => ({
      author,
      email: data.email,
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
      firstCommit: data.firstCommit,
      lastCommit: data.lastCommit,
      percentage:
        totalChanges > 0
          ? Math.round(((data.additions + data.deletions) / totalChanges) * 100)
          : 0,
    }))
    .sort((a, b) => b.commits - a.commits);

  // Convert monthly activity to array
  const activityByMonth = Array.from(monthlyActivity.entries())
    .map(([month, data]) => ({
      month,
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    filePath: normalizeGitPath(filePath),
    totalCommits,
    totalAuthors: authorMap.size,
    totalAdditions,
    totalDeletions,
    totalChanges,
    firstCommitDate,
    lastCommitDate,
    ageInDays,
    authors,
    activityByMonth,
  };
}

/**
 * Get file versions at multiple commits for timeline view
 */
export async function getFileVersions(
  repoPath: string,
  filePath: string,
  commitHashes: string[],
): Promise<FileVersionContent[]> {
  const versions: FileVersionContent[] = [];

  for (const commitHash of commitHashes) {
    try {
      const version = await getFileAtCommit(repoPath, filePath, commitHash);
      versions.push(version);
    } catch (error) {
      // File might not exist in this commit (e.g., before creation or after deletion)
      console.error(`Failed to get file at commit ${commitHash}:`, error);
    }
  }

  return versions;
}

/**
 * Search commits that modified specific lines in file
 */
export async function getLineHistory(
  repoPath: string,
  filePath: string,
  startLine: number,
  endLine: number,
): Promise<FileHistoryEntry[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Use git log -L to track line history
  const logOutput = await git.raw([
    "log",
    "--pretty=format:%H|%h|%ad|%an|%ae|%s",
    "--date=iso",
    `-L${startLine},${endLine}:${normalizeGitPath(filePath)}`,
  ]);

  const entries: FileHistoryEntry[] = [];
  const lines = logOutput.trim().split("\n");

  for (const line of lines) {
    if (line.includes("|")) {
      const [hash, shortHash, date, author, authorEmail, ...messageParts] =
        line.split("|");
      entries.push({
        hash,
        shortHash,
        date,
        author,
        authorEmail,
        message: messageParts.join("|"),
        status: "modified",
        additions: 0,
        deletions: 0,
      });
    }
  }

  return entries;
}
