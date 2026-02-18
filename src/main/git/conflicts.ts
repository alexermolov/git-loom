import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { ConflictFile, ConflictMarker } from "./types";

/**
 * Get list of conflicted files
 */
export async function getConflictedFiles(repoPath: string): Promise<string[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const status = await git.status();
    return status.conflicted || [];
  } catch (error) {
    console.error("Error getting conflicted files:", error);
    throw error;
  }
}

/**
 * Parse conflict markers in a file
 */
export async function getFileConflicts(
  repoPath: string,
  filePath: string,
): Promise<ConflictFile> {
  try {
    const fullPath = path.join(repoPath, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    const conflicts: ConflictMarker[] = [];
    let i = 0;

    while (i < lines.length) {
      // Look for conflict start marker
      if (lines[i].startsWith("<<<<<<<")) {
        const startLine = i;
        const currentLines: string[] = [];
        const incomingLines: string[] = [];
        const baseLines: string[] = [];
        let hasBase = false;

        // Collect current (HEAD) content
        i++;
        while (
          i < lines.length &&
          !lines[i].startsWith("|||||||") &&
          !lines[i].startsWith("=======")
        ) {
          currentLines.push(lines[i]);
          i++;
        }

        // Check for base content (diff3 style)
        if (lines[i]?.startsWith("|||||||")) {
          hasBase = true;
          i++;
          while (i < lines.length && !lines[i].startsWith("=======")) {
            baseLines.push(lines[i]);
            i++;
          }
        }

        // Skip separator
        if (lines[i]?.startsWith("=======")) {
          i++;
        }

        // Collect incoming content
        while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
          incomingLines.push(lines[i]);
          i++;
        }

        const endLine = i;

        conflicts.push({
          startLine,
          endLine,
          currentContent: currentLines.join("\n"),
          incomingContent: incomingLines.join("\n"),
          baseContent: hasBase ? baseLines.join("\n") : undefined,
        });
      }
      i++;
    }

    return {
      path: filePath,
      conflicts,
    };
  } catch (error) {
    console.error("Error getting file conflicts:", error);
    throw error;
  }
}

/**
 * Resolve a conflict by choosing a resolution strategy
 */
export async function resolveConflict(
  repoPath: string,
  filePath: string,
  resolution: "ours" | "theirs" | "both",
  conflictIndex?: number,
): Promise<void> {
  try {
    const conflictFile = await getFileConflicts(repoPath, filePath);
    const fullPath = path.join(repoPath, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const newLines: string[] = [];

    // Determine which conflicts to resolve
    const conflictsToResolve =
      conflictIndex !== undefined
        ? [conflictFile.conflicts[conflictIndex]]
        : conflictFile.conflicts;

    let currentLineIndex = 0;
    let processedConflicts = 0;

    for (const conflict of conflictFile.conflicts) {
      // Add lines before conflict
      while (currentLineIndex < conflict.startLine) {
        newLines.push(lines[currentLineIndex]);
        currentLineIndex++;
      }

      // Check if this conflict should be resolved
      const shouldResolve =
        conflictIndex === undefined || processedConflicts === conflictIndex;

      if (shouldResolve) {
        // Add resolved content based on strategy
        switch (resolution) {
          case "ours":
            newLines.push(conflict.currentContent);
            break;
          case "theirs":
            newLines.push(conflict.incomingContent);
            break;
          case "both":
            newLines.push(conflict.currentContent);
            newLines.push(conflict.incomingContent);
            break;
        }

        // Skip to end of conflict
        currentLineIndex = conflict.endLine + 1;
      } else {
        // Keep conflict markers as-is
        while (currentLineIndex <= conflict.endLine) {
          newLines.push(lines[currentLineIndex]);
          currentLineIndex++;
        }
      }

      processedConflicts++;
    }

    // Add remaining lines
    while (currentLineIndex < lines.length) {
      newLines.push(lines[currentLineIndex]);
      currentLineIndex++;
    }

    // Write resolved content
    fs.writeFileSync(fullPath, newLines.join("\n"), "utf-8");

    // If all conflicts resolved, stage the file
    const remainingConflicts = await getFileConflicts(repoPath, filePath);
    if (remainingConflicts.conflicts.length === 0) {
      const git: SimpleGit = simpleGit(repoPath);
      await git.add(filePath);
    }
  } catch (error) {
    console.error("Error resolving conflict:", error);
    throw error;
  }
}

/**
 * Manually resolve conflict with custom content
 */
export async function resolveConflictManual(
  repoPath: string,
  filePath: string,
  content: string,
): Promise<void> {
  try {
    const fullPath = path.join(repoPath, filePath);
    fs.writeFileSync(fullPath, content, "utf-8");

    // Stage the resolved file
    const git: SimpleGit = simpleGit(repoPath);
    await git.add(filePath);
  } catch (error) {
    console.error("Error manually resolving conflict:", error);
    throw error;
  }
}

/**
 * Launch external merge tool
 */
export async function launchMergeTool(
  repoPath: string,
  filePath: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Launch merge tool for the specific file
    await git.raw(["mergetool", "--no-prompt", filePath]);
  } catch (error) {
    console.error("Error launching merge tool:", error);
    throw error;
  }
}

/**
 * Abort ongoing merge
 */
export async function abortMerge(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.raw(["merge", "--abort"]);
  } catch (error) {
    console.error("Error aborting merge:", error);
    throw error;
  }
}

/**
 * Continue merge after resolving conflicts
 */
export async function continueMerge(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Check if there are still unresolved conflicts
    const conflictedFiles = await getConflictedFiles(repoPath);
    if (conflictedFiles.length > 0) {
      throw new Error(
        `Cannot continue merge: ${conflictedFiles.length} file(s) still have conflicts`,
      );
    }

    // Continue with merge commit
    await git.raw(["commit", "--no-edit"]);
  } catch (error) {
    console.error("Error continuing merge:", error);
    throw error;
  }
}
