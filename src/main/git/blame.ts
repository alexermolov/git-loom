import simpleGit, { SimpleGit } from "simple-git";
import { BlameLine } from "./types";

/**
 * Get blame information for a file
 */
export async function getFileBlame(
  repoPath: string,
  filePath: string,
): Promise<BlameLine[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Run git blame with porcelain format for easier parsing
    const result = await git.raw([
      "blame",
      "--line-porcelain",
      "HEAD",
      "--",
      filePath,
    ]);

    const lines = result.split("\n");
    const blameData: BlameLine[] = [];
    let currentBlame: Partial<BlameLine> = {};
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      // New blame block starts with a commit hash
      if (line.match(/^[0-9a-f]{40}/)) {
        const parts = line.split(" ");
        currentBlame.hash = parts[0];
        lineNumber = parseInt(parts[2], 10);
        currentBlame.lineNumber = lineNumber;
      } else if (line.startsWith("author ")) {
        currentBlame.author = line.substring(7);
      } else if (line.startsWith("author-time ")) {
        const timestamp = parseInt(line.substring(12), 10);
        currentBlame.date = new Date(timestamp * 1000).toISOString();
      } else if (line.startsWith("summary ")) {
        currentBlame.summary = line.substring(8);
      } else if (line.startsWith("\t")) {
        // This is the actual line content
        currentBlame.content = line.substring(1);

        // We have all the data for this line, add it
        if (
          currentBlame.hash &&
          currentBlame.author &&
          currentBlame.date &&
          currentBlame.lineNumber
        ) {
          blameData.push({
            lineNumber: currentBlame.lineNumber,
            hash: currentBlame.hash,
            author: currentBlame.author,
            date: currentBlame.date,
            content: currentBlame.content || "",
            summary: currentBlame.summary || "",
          });
        }

        // Reset for next line
        currentBlame = {};
      }
    }

    return blameData;
  } catch (error) {
    console.error("Error getting file blame:", error);
    throw error;
  }
}
