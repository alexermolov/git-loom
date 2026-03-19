import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import simpleGit from "simple-git";
import {
  compareFileAcrossCommits,
  getFileAtCommit,
  getFileHistory,
  getFileStatistics,
  getLineHistory,
  restoreFileFromCommit,
} from "../src/main/git/fileHistory";

async function main() {
  const repoPath = path.resolve(process.cwd(), ".tmp/file-history-repo");
  const filePath = "src/beta.ts";

  const history = await getFileHistory(repoPath, filePath, 20);
  assert.equal(history.totalCommits, 5, "expected 5 commits in file history");
  assert.equal(history.renames.length, 1, "expected one rename event");
  assert.equal(history.renames[0].from, "src/alpha.ts");
  assert.equal(history.renames[0].to, "src/beta.ts");
  assert.equal(history.firstCommit.status, "added");
  assert.equal(history.lastCommit.status, "deleted");

  const addCommit = history.history.find((entry) => entry.message === "feat: add alpha file");
  const updateCommit = history.history.find(
    (entry) => entry.message === "feat: update beta behavior",
  );

  assert.ok(addCommit, "expected add commit to be present");
  assert.ok(updateCommit, "expected update commit to be present");

  const oldVersion = await getFileAtCommit(repoPath, filePath, addCommit!.hash);
  assert.equal(oldVersion.filePath, "src/alpha.ts");
  assert.match(oldVersion.content, /hello \$\{name\}/);

  const comparison = await compareFileAcrossCommits(
    repoPath,
    filePath,
    addCommit!.hash,
    updateCommit!.hash,
  );
  assert.ok(comparison.changedLines > 0, "expected comparison to contain changes");
  assert.match(comparison.diff, /hello, \$\{name\.toUpperCase\(\)\}!/);

  const statistics = await getFileStatistics(repoPath, filePath);
  assert.equal(statistics.totalCommits, 5);
  assert.equal(statistics.totalAuthors, 1);
  assert.ok(statistics.totalDeletions > 0, "expected deletion stats to be recorded");

  await restoreFileFromCommit(repoPath, filePath, updateCommit!.hash);
  const restoredContent = await fs.readFile(path.join(repoPath, filePath), "utf8");
  assert.match(restoredContent, /goodbye \$\{name\}/);

  const git = simpleGit(repoPath);
  await git.add([filePath]);
  await git.commit("test: restore beta for line history");

  const lineHistory = await getLineHistory(repoPath, filePath, 1, 3);
  assert.ok(lineHistory.length > 0, "expected line history results after restore");

  console.log(
    JSON.stringify(
      {
        repoPath,
        totalCommits: history.totalCommits,
        renameCount: history.renames.length,
        firstCommit: history.firstCommit.message,
        lastCommit: history.lastCommit.message,
        oldVersionPath: oldVersion.filePath,
        comparisonChangedLines: comparison.changedLines,
        statistics: {
          totalCommits: statistics.totalCommits,
          totalAuthors: statistics.totalAuthors,
          totalAdditions: statistics.totalAdditions,
          totalDeletions: statistics.totalDeletions,
        },
        lineHistoryCount: lineHistory.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});