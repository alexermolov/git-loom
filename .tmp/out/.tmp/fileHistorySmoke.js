"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert/strict"));
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const simple_git_1 = __importDefault(require("simple-git"));
const fileHistory_1 = require("../src/main/git/fileHistory");
async function main() {
    const repoPath = path.resolve(process.cwd(), ".tmp/file-history-repo");
    const filePath = "src/beta.ts";
    const history = await (0, fileHistory_1.getFileHistory)(repoPath, filePath, 20);
    assert.equal(history.totalCommits, 5, "expected 5 commits in file history");
    assert.equal(history.renames.length, 1, "expected one rename event");
    assert.equal(history.renames[0].from, "src/alpha.ts");
    assert.equal(history.renames[0].to, "src/beta.ts");
    assert.equal(history.firstCommit.status, "added");
    assert.equal(history.lastCommit.status, "deleted");
    const addCommit = history.history.find((entry) => entry.message === "feat: add alpha file");
    const updateCommit = history.history.find((entry) => entry.message === "feat: update beta behavior");
    assert.ok(addCommit, "expected add commit to be present");
    assert.ok(updateCommit, "expected update commit to be present");
    const oldVersion = await (0, fileHistory_1.getFileAtCommit)(repoPath, filePath, addCommit.hash);
    assert.equal(oldVersion.filePath, "src/alpha.ts");
    assert.match(oldVersion.content, /hello \$\{name\}/);
    const comparison = await (0, fileHistory_1.compareFileAcrossCommits)(repoPath, filePath, addCommit.hash, updateCommit.hash);
    assert.ok(comparison.changedLines > 0, "expected comparison to contain changes");
    assert.match(comparison.diff, /hello, \$\{name\.toUpperCase\(\)\}!/);
    const statistics = await (0, fileHistory_1.getFileStatistics)(repoPath, filePath);
    assert.equal(statistics.totalCommits, 5);
    assert.equal(statistics.totalAuthors, 1);
    assert.ok(statistics.totalDeletions > 0, "expected deletion stats to be recorded");
    await (0, fileHistory_1.restoreFileFromCommit)(repoPath, filePath, updateCommit.hash);
    const restoredContent = await fs.readFile(path.join(repoPath, filePath), "utf8");
    assert.match(restoredContent, /goodbye \$\{name\}/);
    const git = (0, simple_git_1.default)(repoPath);
    await git.add([filePath]);
    await git.commit("test: restore beta for line history");
    const lineHistory = await (0, fileHistory_1.getLineHistory)(repoPath, filePath, 1, 3);
    assert.ok(lineHistory.length > 0, "expected line history results after restore");
    console.log(JSON.stringify({
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
    }, null, 2));
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
