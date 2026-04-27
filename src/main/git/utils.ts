import { SimpleGit } from "simple-git";

export async function hasCommits(git: SimpleGit): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch (error) {
    return false;
  }
}
