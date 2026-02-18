import simpleGit, { SimpleGit } from "simple-git";
import { gitCache } from "../cache";
import { TagInfo } from "./types";

/**
 * Get all tags
 */
export async function getTags(repoPath: string): Promise<TagInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  const cacheKey = "tags";

  try {
    const cached = gitCache.get(repoPath, cacheKey);
    if (cached) {
      return cached as TagInfo[];
    }

    const tagsOutput = await git.raw([
      "tag",
      "-l",
      "--format=%(refname:short)|%(objectname)|%(objecttype)",
    ]);
    const tags: TagInfo[] = [];

    if (tagsOutput.trim()) {
      const lines = tagsOutput.trim().split("\n");

      for (const line of lines) {
        const [name, objectHash, objectType] = line.split("|");

        if (!name) continue;

        if (objectType === "tag") {
          try {
            const tagDetails = await git.raw([
              "show",
              "--format=%H|%an|%aI|%B",
              "--no-patch",
              name,
            ]);
            const [commitHash, tagger, date, ...messageLines] = tagDetails
              .trim()
              .split("\n");
            const [hash] = commitHash.split("|");
            const [, taggerName] = commitHash.split("|");
            const [, , isoDate] = commitHash.split("|");
            const message = messageLines.join("\n").trim();

            tags.push({
              name,
              commitHash: hash || objectHash,
              type: "annotated",
              tagger: taggerName,
              date: isoDate,
              message: message || undefined,
            });
          } catch (error) {
            tags.push({
              name,
              commitHash: objectHash,
              type: "annotated",
            });
          }
        } else {
          tags.push({
            name,
            commitHash: objectHash,
            type: "lightweight",
          });
        }
      }
    }

    tags.sort((a, b) => a.name.localeCompare(b.name));
    gitCache.set(repoPath, cacheKey, tags);

    return tags;
  } catch (error) {
    console.error("Error getting tags:", error);
    throw error;
  }
}

/**
 * Create a lightweight tag
 */
export async function createLightweightTag(
  repoPath: string,
  tagName: string,
  commitHash?: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    if (!/^[a-zA-Z0-9._\/-]+$/.test(tagName)) {
      throw new Error(
        "Tag name can only contain letters, numbers, dots, underscores, slashes, and hyphens",
      );
    }

    const existingTags = await getTags(repoPath);
    if (existingTags.some((t) => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' already exists`);
    }

    const args = ["tag", tagName];
    if (commitHash) {
      args.push(commitHash);
    }

    await git.raw(args);
    gitCache.invalidate(repoPath, "tags");
  } catch (error) {
    console.error("Error creating lightweight tag:", error);
    throw error;
  }
}

/**
 * Create an annotated tag
 */
export async function createAnnotatedTag(
  repoPath: string,
  tagName: string,
  message: string,
  commitHash?: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    if (!/^[a-zA-Z0-9._\/-]+$/.test(tagName)) {
      throw new Error(
        "Tag name can only contain letters, numbers, dots, underscores, slashes, and hyphens",
      );
    }

    const existingTags = await getTags(repoPath);
    if (existingTags.some((t) => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' already exists`);
    }

    if (!message || message.trim() === "") {
      throw new Error("Annotated tags require a message");
    }

    const args = ["tag", "-a", tagName, "-m", message];
    if (commitHash) {
      args.push(commitHash);
    }

    await git.raw(args);
    gitCache.invalidate(repoPath, "tags");
  } catch (error) {
    console.error("Error creating annotated tag:", error);
    throw error;
  }
}

/**
 * Delete a local tag
 */
export async function deleteTag(
  repoPath: string,
  tagName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const existingTags = await getTags(repoPath);
    if (!existingTags.some((t) => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' does not exist`);
    }

    await git.raw(["tag", "-d", tagName]);
    gitCache.invalidate(repoPath, "tags");
  } catch (error) {
    console.error("Error deleting tag:", error);
    throw error;
  }
}

/**
 * Delete a remote tag
 */
export async function deleteRemoteTag(
  repoPath: string,
  remoteName: string,
  tagName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const remotes = await git.getRemotes();
    if (!remotes.some((r) => r.name === remoteName)) {
      throw new Error(`Remote '${remoteName}' does not exist`);
    }

    await git.push([remoteName, ":refs/tags/" + tagName]);
    gitCache.invalidate(repoPath, "tags");
  } catch (error) {
    console.error("Error deleting remote tag:", error);
    throw error;
  }
}

/**
 * Push tag(s) to remote
 */
export async function pushTags(
  repoPath: string,
  remoteName: string,
  tagName?: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const remotes = await git.getRemotes();
    if (!remotes.some((r) => r.name === remoteName)) {
      throw new Error(`Remote '${remoteName}' does not exist`);
    }

    if (tagName) {
      await git.push([remoteName, "refs/tags/" + tagName]);
    } else {
      await git.push([remoteName, "--tags"]);
    }
  } catch (error) {
    console.error("Error pushing tags:", error);
    throw error;
  }
}

/**
 * Checkout a tag (creates detached HEAD)
 */
export async function checkoutTag(
  repoPath: string,
  tagName: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const existingTags = await getTags(repoPath);
    if (!existingTags.some((t) => t.name === tagName)) {
      throw new Error(`Tag '${tagName}' does not exist`);
    }

    await git.checkout(tagName);
    gitCache.invalidate(repoPath, "repositoryInfo");
    gitCache.invalidate(repoPath, "branches");
  } catch (error) {
    console.error("Error checking out tag:", error);
    throw error;
  }
}

/**
 * Get tag details (for a specific tag)
 */
export async function getTagDetails(
  repoPath: string,
  tagName: string,
): Promise<TagInfo | null> {
  try {
    const tags = await getTags(repoPath);
    const tag = tags.find((t) => t.name === tagName);

    if (!tag) {
      return null;
    }

    return tag;
  } catch (error) {
    console.error("Error getting tag details:", error);
    throw error;
  }
}
