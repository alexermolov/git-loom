import simpleGit, { SimpleGit } from "simple-git";
import { SearchFilter, SearchResult } from "./types";

/**
 * Search commits with various filters
 */
export async function searchCommits(
  repoPath: string,
  filter: SearchFilter,
  limit: number = 100,
): Promise<SearchResult[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const args: string[] = [
      "log",
      `--max-count=${limit}`,
      "--pretty=format:%H|%ai|%s|%an|%D",
    ];

    // Add branch filter
    if (filter.branch) {
      args.push(filter.branch);
    } else {
      args.push("--all");
    }

    // Add author filter
    if (filter.author) {
      args.push(`--author=${filter.author}`);
    }

    // Add date filters
    if (filter.dateFrom) {
      args.push(`--since=${filter.dateFrom}`);
    }
    if (filter.dateTo) {
      args.push(`--until=${filter.dateTo}`);
    }

    // Add message filter (grep) - only for non-hash queries
    if (filter.query && !/^[0-9a-f]{6,40}$/i.test(filter.query)) {
      args.push(`--grep=${filter.query}`);
      args.push(`--regexp-ignore-case`);
    }

    const result = await git.raw(args);

    if (!result || result.trim() === "") {
      return [];
    }

    const lines = result.trim().split("\n");
    const commits: SearchResult[] = lines.map((line) => {
      const [hash, date, message, author, refs] = line.split("|");
      return { hash, date, message, author, refs: refs || "" };
    });

    // Filter by query after getting results
    if (filter.query) {
      const query = filter.query.toLowerCase();
      const isHashQuery = /^[0-9a-f]{6,40}$/i.test(filter.query);

      return commits.filter((c) => {
        if (isHashQuery) {
          // For hash queries, check if commit hash starts with the query
          return c.hash.toLowerCase().startsWith(query);
        } else {
          // For text queries, search in both message and hash
          return (
            c.message.toLowerCase().includes(query) ||
            c.hash.toLowerCase().includes(query)
          );
        }
      });
    }

    return commits;
  } catch (error) {
    console.error("Error searching commits:", error);
    return [];
  }
}

/**
 * Search across multiple repositories
 */
export async function searchCommitsMultiRepo(
  repoPaths: string[],
  filter: SearchFilter,
  limit: number = 100,
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();

  for (const repoPath of repoPaths) {
    try {
      const commits = await searchCommits(repoPath, filter, limit);
      if (commits.length > 0) {
        results.set(repoPath, commits);
      }
    } catch (error) {
      console.error(`Error searching repo ${repoPath}:`, error);
    }
  }

  return results;
}

/**
 * Get unique authors from repository for filter suggestions
 */
export async function getAuthors(repoPath: string): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const result = await git.raw([
      "log",
      "--all",
      "--format=%an",
      "--no-merges",
    ]);
    if (!result || result.trim() === "") {
      return [];
    }

    const authors = result.trim().split("\n");
    // Remove duplicates and sort
    return [...new Set(authors)].sort();
  } catch (error) {
    console.error("Error getting authors:", error);
    return [];
  }
}
