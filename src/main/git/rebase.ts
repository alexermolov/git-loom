import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { gitCache } from "../cache";
import { RebaseCommit, RebasePlan, RebaseStatus } from "./types";

/**
 * Get commits that would be rebased
 */
export async function getRebasePlan(
  repoPath: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<RebasePlan> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get the merge-base (common ancestor)
    const mergeBase = await git.raw(["merge-base", sourceBranch, targetBranch]);

    const baseCommit = mergeBase.trim();

    // Get commits between base and source branch
    const logResult = await git.raw([
      "log",
      "--format=%H%x00%h%x00%s%x00%an%x00%ai",
      "--reverse",
      `${baseCommit}..${sourceBranch}`,
    ]);

    const commits: RebaseCommit[] = [];

    if (logResult.trim()) {
      const commitLines = logResult.trim().split("\n");

      for (const line of commitLines) {
        const [hash, shortHash, message, author, date] = line.split("\x00");

        if (hash && message) {
          commits.push({
            hash,
            shortHash,
            action: "pick",
            message,
            author,
            date,
          });
        }
      }
    }

    return {
      commits,
      sourceBranch: sourceBranch,
      targetBranch,
      currentBranch: sourceBranch,
      targetCommit: baseCommit,
    };
  } catch (error) {
    console.error("Error getting rebase plan:", error);
    throw error;
  }
}

/**
 * Start an interactive rebase
 */
export async function startInteractiveRebase(
  repoPath: string,
  targetBranch: string,
  rebasePlan: RebaseCommit[],
): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Check for uncommitted changes
    const status = await git.status();
    if (status.files.length > 0) {
      throw new Error(
        "Cannot start rebase: you have uncommitted changes. Please commit or stash them first.",
      );
    }

    // Build the rebase todo content
    const todoLines = rebasePlan
      .map((commit) => {
        return `${commit.action} ${commit.hash} ${commit.message}`;
      })
      .join("\n");

    // Create a temporary file for our custom plan
    const rebaseTodoBackup = path.join(repoPath, ".git", "GITLOOM_REBASE_TODO");
    fs.writeFileSync(rebaseTodoBackup, todoLines, "utf-8");

    // Create a map of commit hashes to new messages for reword actions
    // AND create an ordered list mapping line numbers to hashes
    const rewordMessages = new Map<string, string>();
    const todoHashOrder: string[] = [];
    for (const commit of rebasePlan) {
      todoHashOrder.push(commit.hash);
      if (commit.action === "reword") {
        rewordMessages.set(commit.hash, commit.message);
      }
    }
    const rewordMessagesPath = path.join(
      repoPath,
      ".git",
      "GITLOOM_REWORD_MESSAGES.json",
    );
    const rewordMessagesJson = JSON.stringify(
      Object.fromEntries(rewordMessages),
      null,
      2,
    );
    fs.writeFileSync(rewordMessagesPath, rewordMessagesJson, "utf-8");

    // Save the ordered list of hashes for position-based lookup
    const todoOrderPath = path.join(
      repoPath,
      ".git",
      "GITLOOM_TODO_ORDER.json",
    );
    fs.writeFileSync(
      todoOrderPath,
      JSON.stringify(todoHashOrder, null, 2),
      "utf-8",
    );

    // Create a script that will copy our plan to the git-rebase-todo file.
    // This script will be used as GIT_SEQUENCE_EDITOR.
    const isWindows = process.platform === "win32";
    let editorScript: string;
    let editorScriptPath: string;
    let commitEditorScript: string;
    let commitEditorScriptPath: string;

    if (isWindows) {
      // Git for Windows executes sequence editors via sh, and raw `D:\...\file.bat`
      // often fails (backslashes get eaten). PowerShell is a reliable cross-shell entry.
      editorScriptPath = path.join(repoPath, ".git", "GITLOOM_EDITOR.ps1");
      editorScript =
        [
          "param([Parameter(Mandatory=$true)][string]$TodoPath)",
          `$src = '${rebaseTodoBackup.replace(/'/g, "''")}'`,
          "Copy-Item -LiteralPath $src -Destination $TodoPath -Force | Out-Null",
        ].join("\r\n") + "\r\n";
      fs.writeFileSync(editorScriptPath, editorScript, "utf-8");

      // Create commit message editor for reword actions
      // IMPORTANT: Do NOT try to parse the commit hash from the message template.
      // Git does not consistently include the commit hash in COMMIT_EDITMSG during reword.
      // Instead, read the currently stopped commit hash from .git/rebase-merge/stopped-sha.
      commitEditorScriptPath = path.join(
        repoPath,
        ".git",
        "GITLOOM_COMMIT_EDITOR.ps1",
      );
      commitEditorScript =
        [
          "param([Parameter(Mandatory=$true)][string]$MessagePath)",
          `$messagesFile = '${rewordMessagesPath.replace(/'/g, "''")}'`,
          `$todoOrderFile = '${path.join(repoPath, ".git", "GITLOOM_TODO_ORDER.json").replace(/'/g, "''")}'`,
          `$repoGitDir = '${path.join(repoPath, ".git").replace(/'/g, "''")}'`,
          "if (Test-Path $messagesFile) {",
          "  $messages = Get-Content $messagesFile -Raw | ConvertFrom-Json",
          "  ",
          '  $msgnumPath = Join-Path $repoGitDir "rebase-merge\\msgnum"',
          "  if ((Test-Path $msgnumPath) -and (Test-Path $todoOrderFile)) {",
          "    $msgnum = [int](Get-Content $msgnumPath -Raw).Trim()",
          "    $todoOrder = Get-Content $todoOrderFile -Raw | ConvertFrom-Json",
          "    if ($msgnum -ge 1 -and $msgnum -le $todoOrder.Count) {",
          "      $hash = $todoOrder[$msgnum - 1]",
          "      if ($messages.$hash) {",
          "        Set-Content -Path $MessagePath -Value $messages.$hash -NoNewline",
          "      }",
          "    }",
          "  }",
          "}",
        ].join("\r\n") + "\r\n";
      fs.writeFileSync(commitEditorScriptPath, commitEditorScript, "utf-8");
    } else {
      editorScriptPath = path.join(repoPath, ".git", "GITLOOM_EDITOR.sh");
      editorScript = `#!/bin/sh\ncp "${rebaseTodoBackup}" "$1"`;
      fs.writeFileSync(editorScriptPath, editorScript, "utf-8");
      fs.chmodSync(editorScriptPath, "755");

      // Create commit message editor for reword actions
      // IMPORTANT: Read the stopped-sha file to get the current commit hash
      commitEditorScriptPath = path.join(
        repoPath,
        ".git",
        "GITLOOM_COMMIT_EDITOR.sh",
      );
      const gitDir = path.join(repoPath, ".git");
      const todoOrderPath = path.join(
        repoPath,
        ".git",
        "GITLOOM_TODO_ORDER.json",
      );
      commitEditorScript = [
        "#!/bin/sh",
        `MESSAGES_FILE="${rewordMessagesPath}"`,
        `TODO_ORDER_FILE="${todoOrderPath}"`,
        `GIT_DIR="${gitDir}"`,
        'if [ -f "$MESSAGES_FILE" ]; then',
        '  MSGNUM_FILE="$GIT_DIR/rebase-merge/msgnum"',
        '  if [ -f "$MSGNUM_FILE" ] && [ -f "$TODO_ORDER_FILE" ]; then',
        '    msgnum=$(cat "$MSGNUM_FILE" | tr -d "\\n\\r")',
        '    hash=$(jq -r ".[$msgnum - 1]" "$TODO_ORDER_FILE" 2>/dev/null)',
        '    if [ "$hash" != "null" ] && [ -n "$hash" ]; then',
        '      newmsg=$(jq -r ".\\\"$hash\\\"" "$MESSAGES_FILE" 2>/dev/null)',
        '      if [ "$newmsg" != "null" ] && [ -n "$newmsg" ]; then',
        '        echo "$newmsg" > "$1"',
        "      fi",
        "    fi",
        "  fi",
        "fi",
      ].join("\n");
      fs.writeFileSync(commitEditorScriptPath, commitEditorScript, "utf-8");
      fs.chmodSync(commitEditorScriptPath, "755");
    }

    const rebaseMergePath = path.join(repoPath, ".git", "rebase-merge");
    const rebaseApplyPath = path.join(repoPath, ".git", "rebase-apply");

    // Start the rebase with our custom editor
    try {
      const sequenceEditor = isWindows
        ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${editorScriptPath}"`
        : editorScriptPath;

      const commitEditor = isWindows
        ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${commitEditorScriptPath}"`
        : commitEditorScriptPath;

      await git
        .env({
          ...process.env,
          GIT_SEQUENCE_EDITOR: sequenceEditor,
          GIT_EDITOR: commitEditor,
        })
        .raw(["rebase", "-i", "--autosquash", targetBranch]);

      // Interactive rebase can rewrite history; invalidate caches so subsequent UI refresh
      // reflects new commit messages/order/hashes immediately.
      gitCache.invalidate(repoPath);

      // Clean up temporary files
      if (fs.existsSync(rebaseTodoBackup)) {
        fs.unlinkSync(rebaseTodoBackup);
      }
      if (fs.existsSync(editorScriptPath)) {
        fs.unlinkSync(editorScriptPath);
      }
      if (fs.existsSync(commitEditorScriptPath)) {
        fs.unlinkSync(commitEditorScriptPath);
      }
      if (fs.existsSync(rewordMessagesPath)) {
        fs.unlinkSync(rewordMessagesPath);
      }
      const todoOrderPath = path.join(
        repoPath,
        ".git",
        "GITLOOM_TODO_ORDER.json",
      );
      if (fs.existsSync(todoOrderPath)) {
        fs.unlinkSync(todoOrderPath);
      }

      return {
        inProgress: false,
      };
    } catch (rebaseError: any) {
      // Git returns non-zero for several cases:
      // - rebase actually started and is waiting (conflicts, edit/reword, etc.)
      // - rebase failed to start at all (e.g. couldn't run sequence editor)
      // Distinguish these to avoid showing a phantom "Continue" state in the UI.
      const actuallyInProgress =
        fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath);

      if (!actuallyInProgress) {
        // Clean up temporary files because the rebase didn't start.
        if (fs.existsSync(rebaseTodoBackup)) {
          fs.unlinkSync(rebaseTodoBackup);
        }
        if (fs.existsSync(editorScriptPath)) {
          fs.unlinkSync(editorScriptPath);
        }
        const commitEditorPs1 = path.join(
          repoPath,
          ".git",
          "GITLOOM_COMMIT_EDITOR.ps1",
        );
        if (fs.existsSync(commitEditorPs1)) {
          fs.unlinkSync(commitEditorPs1);
        }
        const commitEditorSh = path.join(
          repoPath,
          ".git",
          "GITLOOM_COMMIT_EDITOR.sh",
        );
        if (fs.existsSync(commitEditorSh)) {
          fs.unlinkSync(commitEditorSh);
        }
        const rewordMsgs = path.join(
          repoPath,
          ".git",
          "GITLOOM_REWORD_MESSAGES.json",
        );
        if (fs.existsSync(rewordMsgs)) {
          fs.unlinkSync(rewordMsgs);
        }
        const todoOrderFile = path.join(
          repoPath,
          ".git",
          "GITLOOM_TODO_ORDER.json",
        );
        if (fs.existsSync(todoOrderFile)) {
          fs.unlinkSync(todoOrderFile);
        }

        throw rebaseError;
      }

      // Rebase started but has conflicts or is waiting for user input.
      const statusAfter = await git.status();
      const conflictedFiles = statusAfter.conflicted || [];

      // Rebase may already have rewritten some commits before stopping; invalidate caches.
      gitCache.invalidate(repoPath);

      // Don't clean up scripts yet, we might need them for continue.
      return {
        inProgress: true,
        hasConflicts: conflictedFiles.length > 0,
        conflictedFiles,
      };
    }
  } catch (error) {
    console.error("Error starting interactive rebase:", error);
    throw error;
  }
}

/**
 * Get rebase status
 */
export async function getRebaseStatus(repoPath: string): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const rebaseMergePath = path.join(repoPath, ".git", "rebase-merge");
    const rebaseApplyPath = path.join(repoPath, ".git", "rebase-apply");

    const inProgress =
      fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath);

    if (!inProgress) {
      return { inProgress: false };
    }

    // Get conflicted files from git status
    const status = await git.status();
    let conflictedFiles = status.conflicted || [];

    // Double-check if files actually contain conflict markers
    // Sometimes git status shows conflicts even after manual resolution
    const actualConflictedFiles: string[] = [];
    for (const file of conflictedFiles) {
      try {
        const filePath = path.join(repoPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          // Check for conflict markers
          if (
            content.includes("<<<<<<<") &&
            content.includes("=======") &&
            content.includes(">>>>>>>")
          ) {
            actualConflictedFiles.push(file);
          }
        }
      } catch (err) {
        // If we can't read the file, assume it's still conflicted
        actualConflictedFiles.push(file);
      }
    }

    // Try to read rebase state
    let currentCommit: string | undefined;
    let remainingCommits: number | undefined;

    if (fs.existsSync(rebaseMergePath)) {
      const headNamePath = path.join(rebaseMergePath, "head-name");
      const ontoPath = path.join(rebaseMergePath, "onto");
      const msgNumPath = path.join(rebaseMergePath, "msgnum");
      const endPath = path.join(rebaseMergePath, "end");

      if (fs.existsSync(msgNumPath) && fs.existsSync(endPath)) {
        const msgNum = parseInt(
          fs.readFileSync(msgNumPath, "utf-8").trim(),
          10,
        );
        const end = parseInt(fs.readFileSync(endPath, "utf-8").trim(), 10);
        remainingCommits = end - msgNum;
      }
    }

    return {
      inProgress: true,
      currentCommit,
      remainingCommits,
      hasConflicts: actualConflictedFiles.length > 0,
      conflictedFiles: actualConflictedFiles,
    };
  } catch (error) {
    console.error("Error getting rebase status:", error);
    return { inProgress: false };
  }
}

/**
 * Continue rebase after resolving conflicts
 */
export async function continueRebase(repoPath: string): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    console.log("=== CONTINUE REBASE ===");
    console.log("Repository:", repoPath);

    // If a rebase isn't actually in progress, treat it as a no-op.
    // This avoids a confusing UX where the button appears to do nothing.
    const rebaseMergePath = path.join(repoPath, ".git", "rebase-merge");
    const rebaseApplyPath = path.join(repoPath, ".git", "rebase-apply");
    const inProgress =
      fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath);
    console.log("Rebase in progress?", inProgress);
    if (!inProgress) {
      console.log("No rebase in progress - returning");
      return { inProgress: false };
    }

    // Check if there are still conflicts
    const status = await git.status();
    console.log("Rebase status before continue:", {
      conflicted: status.conflicted,
      modified: status.modified,
      not_added: status.not_added,
      created: status.created,
      deleted: status.deleted,
    });

    if (status.conflicted && status.conflicted.length > 0) {
      throw new Error("Cannot continue rebase: there are unresolved conflicts");
    }

    // Stage all modified files that were involved in conflict resolution
    // This is necessary when files are edited manually or through external tools
    const filesToStage = [
      ...(status.modified || []),
      ...(status.not_added || []),
      ...(status.created || []),
      ...(status.deleted || []),
      ...(status.renamed || []).map((r) => r.to || r.from),
    ].filter(Boolean);

    if (filesToStage.length > 0) {
      console.log("Staging files before rebase continue:", filesToStage);
      await git.add(filesToStage);
    }

    // Continue the rebase
    try {
      console.log("Executing git rebase --continue");

      // IMPORTANT: `git rebase --continue` can try to spawn an editor (e.g. core.editor=code --wait)
      // which will hang in a GUI app. Force a non-interactive editor so the command either succeeds
      // or fails fast with a real error we can surface.
      const isWindows = process.platform === "win32";
      const noOpEditor = isWindows ? ":" : ":";

      // If a prior interactive rebase was started via startInteractiveRebase(),
      // we may have pending reword steps that require a non-interactive editor
      // capable of applying the desired message.
      const gitDir = path.join(repoPath, ".git");
      const rewordMessagesPath = path.join(
        gitDir,
        "GITLOOM_REWORD_MESSAGES.json",
      );
      const commitEditorPs1 = path.join(gitDir, "GITLOOM_COMMIT_EDITOR.ps1");
      const commitEditorSh = path.join(gitDir, "GITLOOM_COMMIT_EDITOR.sh");

      const hasRewordMessages = fs.existsSync(rewordMessagesPath);

      // Prefer the commit editor script (it applies the reword message).
      // Fall back to a no-op editor to avoid hanging on an interactive editor.
      const commitEditor =
        hasRewordMessages && isWindows && fs.existsSync(commitEditorPs1)
          ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${commitEditorPs1}"`
          : hasRewordMessages && !isWindows && fs.existsSync(commitEditorSh)
            ? commitEditorSh
            : noOpEditor;

      console.log("Environment variables for rebase --continue:");
      console.log("  Has reword messages?", hasRewordMessages);
      console.log("  GIT_EDITOR:", commitEditor);
      console.log("  GIT_SEQUENCE_EDITOR:", noOpEditor);
      console.log("Executing: git rebase --continue");

      await git
        .env({
          ...process.env,
          GIT_EDITOR: commitEditor,
          GIT_SEQUENCE_EDITOR: noOpEditor,
          GIT_TERMINAL_PROMPT: "0",
        })
        .raw(["rebase", "--continue"]);

      console.log("Rebase continue command completed");

      const statusAfter = await getRebaseStatus(repoPath);
      console.log("Status after rebase continue:", statusAfter);

      // Rebase completed successfully - clean up temporary files
      if (!statusAfter.inProgress) {
        console.log("Rebase completed - cleaning up temporary files");
        const backupPath = path.join(repoPath, ".git", "GITLOOM_REBASE_TODO");
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }

        const editorScriptCmd = path.join(
          repoPath,
          ".git",
          "GITLOOM_EDITOR.cmd",
        );
        if (fs.existsSync(editorScriptCmd)) {
          fs.unlinkSync(editorScriptCmd);
        }

        const editorScriptBat = path.join(
          repoPath,
          ".git",
          "GITLOOM_EDITOR.bat",
        );
        if (fs.existsSync(editorScriptBat)) {
          fs.unlinkSync(editorScriptBat);
        }

        const editorScriptPs1 = path.join(
          repoPath,
          ".git",
          "GITLOOM_EDITOR.ps1",
        );
        if (fs.existsSync(editorScriptPs1)) {
          fs.unlinkSync(editorScriptPs1);
        }

        const editorScriptSh = path.join(repoPath, ".git", "GITLOOM_EDITOR.sh");
        if (fs.existsSync(editorScriptSh)) {
          fs.unlinkSync(editorScriptSh);
        }

        const commitEditorPs1 = path.join(
          repoPath,
          ".git",
          "GITLOOM_COMMIT_EDITOR.ps1",
        );
        if (fs.existsSync(commitEditorPs1)) {
          fs.unlinkSync(commitEditorPs1);
        }

        const commitEditorSh = path.join(
          repoPath,
          ".git",
          "GITLOOM_COMMIT_EDITOR.sh",
        );
        if (fs.existsSync(commitEditorSh)) {
          fs.unlinkSync(commitEditorSh);
        }

        const rewordMessages = path.join(
          repoPath,
          ".git",
          "GITLOOM_REWORD_MESSAGES.json",
        );
        if (fs.existsSync(rewordMessages)) {
          fs.unlinkSync(rewordMessages);
        }

        const todoOrderPath = path.join(
          repoPath,
          ".git",
          "GITLOOM_TODO_ORDER.json",
        );
        if (fs.existsSync(todoOrderPath)) {
          fs.unlinkSync(todoOrderPath);
        }
      }

      // Invalidate cache (rebase can change HEAD / history)
      gitCache.invalidate(repoPath);

      console.log("=== REBASE CONTINUE COMPLETE ===");
      return statusAfter;
    } catch (error: any) {
      console.log("Error during rebase continue:", error);
      // Rebase may still be in progress (new conflicts, edit/reword stop, etc.).
      // Only swallow the error if we can confirm the rebase is still in progress;
      // otherwise surface the real failure to the UI.
      const statusAfter = await getRebaseStatus(repoPath);
      console.log("Status after error:", statusAfter);
      if (statusAfter.inProgress) {
        console.log("Rebase still in progress after error");
        return statusAfter;
      }

      const msg = String(error?.message ?? error);
      if (msg.includes("No rebase in progress")) {
        console.log("No rebase in progress");
        return { inProgress: false };
      }

      // Common case: the patch became empty. The correct action is usually "Skip Commit".
      if (
        msg.includes("No changes - did you forget to use") ||
        msg.includes("nothing to commit") ||
        msg.includes("The previous cherry-pick is now empty")
      ) {
        console.log("Patch is empty - user should skip commit");
        throw new Error(
          "Git reports there are no changes to commit for this step. If you intentionally resolved the conflict by making the patch empty, use `Skip Commit`.",
        );
      }

      console.log("Rethrowing error");
      throw error;
    }
  } catch (error) {
    console.error("Error continuing rebase:", error);
    throw error;
  }
}

/**
 * Abort rebase
 */
export async function abortRebase(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.rebase(["--abort"]);

    // Clean up any backup files
    const backupPath = path.join(repoPath, ".git", "GITLOOM_REBASE_TODO");
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    // Clean up editor scripts
    const editorScriptCmd = path.join(repoPath, ".git", "GITLOOM_EDITOR.cmd");
    if (fs.existsSync(editorScriptCmd)) {
      fs.unlinkSync(editorScriptCmd);
    }

    const editorScriptBat = path.join(repoPath, ".git", "GITLOOM_EDITOR.bat");
    if (fs.existsSync(editorScriptBat)) {
      fs.unlinkSync(editorScriptBat);
    }

    const editorScriptPs1 = path.join(repoPath, ".git", "GITLOOM_EDITOR.ps1");
    if (fs.existsSync(editorScriptPs1)) {
      fs.unlinkSync(editorScriptPs1);
    }

    const editorScriptSh = path.join(repoPath, ".git", "GITLOOM_EDITOR.sh");
    if (fs.existsSync(editorScriptSh)) {
      fs.unlinkSync(editorScriptSh);
    }

    // Invalidate cache
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error aborting rebase:", error);
    throw error;
  }
}

/**
 * Skip current commit during rebase
 */
export async function skipRebaseCommit(
  repoPath: string,
): Promise<RebaseStatus> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.rebase(["--skip"]);

    // Skipping can advance/finish the rebase and rewrite history.
    gitCache.invalidate(repoPath);

    // Check status after skip
    return await getRebaseStatus(repoPath);
  } catch (error: any) {
    // If skip completes the rebase
    if (error.message && error.message.includes("No rebase in progress")) {
      gitCache.invalidate(repoPath);
      return { inProgress: false };
    }

    console.error("Error skipping rebase commit:", error);
    throw error;
  }
}

/**
 * Edit a commit message during rebase
 */
export async function editRebaseCommitMessage(
  repoPath: string,
  commitHash: string,
  newMessage: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Use commit --amend to change the message
    await git.raw(["commit", "--amend", "-m", newMessage]);

    // Invalidate cache
    gitCache.invalidate(repoPath);
  } catch (error) {
    console.error("Error editing commit message:", error);
    throw error;
  }
}
