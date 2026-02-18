import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { gitCache } from "../cache";
import { FileTreeNode } from "./types";

/**
 * Get file tree for repository
 */
export async function getFileTree(
  repoPath: string,
  commitHash?: string,
): Promise<FileTreeNode> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const cacheKey = commitHash ? `fileTree-${commitHash}` : "fileTree";
    const cached = gitCache.get<FileTreeNode>(repoPath, cacheKey);
    if (cached) {
      return cached;
    }

    let tree: FileTreeNode;

    if (!commitHash) {
      tree = await buildFileTree(repoPath);
    } else {
      const files = await git.raw(["ls-tree", "-r", "--name-only", commitHash]);
      const fileList = files
        .trim()
        .split("\n")
        .filter((f) => f);
      tree = buildTreeFromPaths(fileList, repoPath);
    }

    gitCache.set(repoPath, cacheKey, tree);

    return tree;
  } catch (error) {
    console.error("Error getting file tree:", error);
    throw error;
  }
}

/**
 * Build file tree from file system with parallel loading
 */
async function buildFileTree(
  dirPath: string,
  relativePath: string = "",
): Promise<FileTreeNode> {
  const name = relativePath ? path.basename(dirPath) : path.basename(dirPath);
  const node: FileTreeNode = {
    name,
    path: relativePath || "/",
    type: "directory",
    children: [],
  };

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    const files: FileTreeNode[] = [];
    const directories: Promise<FileTreeNode>[] = [];

    for (const entry of entries) {
      if (entry.name === ".git") continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        directories.push(buildFileTree(fullPath, relPath));
      } else {
        files.push({
          name: entry.name,
          path: relPath,
          type: "file",
        });
      }
    }

    const directoryNodes = await Promise.all(directories);

    node.children = [...directoryNodes, ...files];

    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("Error building file tree:", error);
  }

  return node;
}

/**
 * Build tree structure from flat file paths
 */
function buildTreeFromPaths(paths: string[], rootPath: string): FileTreeNode {
  const root: FileTreeNode = {
    name: path.basename(rootPath),
    path: "/",
    type: "directory",
    children: [],
  };

  for (const filePath of paths) {
    const parts = filePath.split("/").filter((p) => p);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      let child = current.children!.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "directory",
          ...(isFile ? {} : { children: [] }),
        };
        current.children!.push(child);
      }

      if (!isFile) {
        current = child;
      }
    }
  }

  return root;
}
