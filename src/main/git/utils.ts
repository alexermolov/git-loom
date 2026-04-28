import { SimpleGit } from "simple-git";

export async function hasCommits(git: SimpleGit): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch (error) {
    return false;
  }
}

export async function refExists(git: SimpleGit, ref: string): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getExistingUpstreamRef(
  git: SimpleGit,
  currentBranch: string,
  tracking: string | null,
  preferredRemote: string | null,
): Promise<string | null> {
  if (tracking && (await refExists(git, tracking))) {
    return tracking;
  }

  if (!preferredRemote) {
    return null;
  }

  const sameNameRemoteBranch = `${preferredRemote}/${currentBranch}`;
  return (await refExists(git, sameNameRemoteBranch))
    ? sameNameRemoteBranch
    : null;
}
