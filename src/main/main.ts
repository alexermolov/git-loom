import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { scanForRepositories, getRepositoryInfo, getCommits, getFileTree, getBranches, getCommitFiles, getFileDiff, pullRepository, pushRepository, getGitGraph, getCommitDetails, getStatus, stageFiles, unstageFiles, discardChanges, createCommit, getWorkingFileDiff, checkoutBranch, stashAndCheckout, discardAndCheckout, mergeBranch, getReflog, resetToCommit, cherryPickCommit, getFileContent, createStash, getStashList, applyStash, popStash, dropStash, getStashDiff, getStashFiles, createBranchFromStash, clearAllStashes, getConflictedFiles, getFileConflicts, resolveConflict, resolveConflictManual, launchMergeTool, abortMerge, continueMerge, searchCommits, searchCommitsMultiRepo, getAuthors, getRemotes, addRemote, removeRemote, renameRemote, setRemoteUrl, fetchRemote, pruneRemote, setUpstream, getUpstream, createBranch, deleteBranch, deleteRemoteBranch, renameBranch, setUpstreamBranch, unsetUpstreamBranch, compareBranches, getTags, createLightweightTag, createAnnotatedTag, deleteTag, deleteRemoteTag, pushTags, checkoutTag, checkoutCommit, getTagDetails, getFileBlame } from './gitService';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return result.filePaths[0];
  });

  // Scan for repositories
  ipcMain.handle('git:scanRepositories', async (_event, folderPath: string) => {
    try {
      const repositories = await scanForRepositories(folderPath);
      return repositories;
    } catch (error) {
      console.error('Error scanning repositories:', error);
      throw error;
    }
  });

  // Get repository info
  ipcMain.handle('git:getRepositoryInfo', async (_event, repoPath: string, forceFetch?: boolean) => {
    try {
      const info = await getRepositoryInfo(repoPath, !!forceFetch);
      return info;
    } catch (error) {
      console.error('Error getting repository info:', error);
      throw error;
    }
  });

  // Pull repository (fast-forward only)
  ipcMain.handle('git:pullRepository', async (_event, repoPath: string) => {
    try {
      await pullRepository(repoPath);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error) {
      console.error('Error pulling repository:', error);
      throw error;
    }
  });

  // Push repository
  ipcMain.handle('git:pushRepository', async (_event, repoPath: string) => {
    try {
      await pushRepository(repoPath);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error) {
      console.error('Error pushing repository:', error);
      throw error;
    }
  });

  // Get commits
  ipcMain.handle('git:getCommits', async (_event, repoPath: string, branch?: string, skip?: number, limit?: number) => {
    try {
      const commits = await getCommits(repoPath, branch, skip, limit);
      return commits;
    } catch (error) {
      console.error('Error getting commits:', error);
      throw error;
    }
  });

  // Get file tree
  ipcMain.handle('git:getFileTree', async (_event, repoPath: string, commitHash?: string) => {
    try {
      const tree = await getFileTree(repoPath, commitHash);
      return tree;
    } catch (error) {
      console.error('Error getting file tree:', error);
      throw error;
    }
  });

  // Get branches
  ipcMain.handle('git:getBranches', async (_event, repoPath: string) => {
    try {
      const branches = await getBranches(repoPath);
      return branches;
    } catch (error) {
      console.error('Error getting branches:', error);
      throw error;
    }
  });

  // Get git graph
  ipcMain.handle('git:getGitGraph', async (_event, repoPath: string, branch?: string) => {
    try {
      const graph = await getGitGraph(repoPath, branch);
      return graph;
    } catch (error) {
      console.error('Error getting git graph:', error);
      throw error;
    }
  });

  // Get commit details for graph building
  ipcMain.handle('git:getCommitDetails', async (_event, repoPath: string, branch?: string, maxCount?: number) => {
    try {
      const details = await getCommitDetails(repoPath, branch, maxCount);
      return details;
    } catch (error) {
      console.error('Error getting commit details:', error);
      throw error;
    }
  });

  // Get commit files
  ipcMain.handle('git:getCommitFiles', async (_event, repoPath: string, commitHash: string) => {
    try {
      const files = await getCommitFiles(repoPath, commitHash);
      return files;
    } catch (error) {
      console.error('Error getting commit files:', error);
      throw error;
    }
  });

  // Get file diff
  ipcMain.handle('git:getFileDiff', async (_event, repoPath: string, commitHash: string, filePath: string) => {
    try {
      const diff = await getFileDiff(repoPath, commitHash, filePath);
      return diff;
    } catch (error) {
      console.error('Error getting file diff:', error);
      throw error;
    }
  });

  // Get status
  ipcMain.handle('git:getStatus', async (_event, repoPath: string) => {
    try {
      const status = await getStatus(repoPath);
      return status;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  });

  // Stage files
  ipcMain.handle('git:stageFiles', async (_event, repoPath: string, filePaths: string[]) => {
    try {
      await stageFiles(repoPath, filePaths);
    } catch (error) {
      console.error('Error staging files:', error);
      throw error;
    }
  });

  // Unstage files
  ipcMain.handle('git:unstageFiles', async (_event, repoPath: string, filePaths: string[]) => {
    try {
      await unstageFiles(repoPath, filePaths);
    } catch (error) {
      console.error('Error unstaging files:', error);
      throw error;
    }
  });

  // Discard changes
  ipcMain.handle('git:discardChanges', async (_event, repoPath: string, filePaths: string[]) => {
    try {
      await discardChanges(repoPath, filePaths);
    } catch (error) {
      console.error('Error discarding changes:', error);
      throw error;
    }
  });

  // Create commit
  ipcMain.handle('git:createCommit', async (_event, repoPath: string, message: string) => {
    try {
      await createCommit(repoPath, message);
    } catch (error) {
      console.error('Error creating commit:', error);
      throw error;
    }
  });

  // Get working file diff
  ipcMain.handle('git:getWorkingFileDiff', async (_event, repoPath: string, filePath: string, staged: boolean) => {
    try {
      const diff = await getWorkingFileDiff(repoPath, filePath, staged);
      return diff;
    } catch (error) {
      console.error('Error getting working file diff:', error);
      throw error;
    }
  });

  // Checkout branch
  ipcMain.handle('git:checkoutBranch', async (_event, repoPath: string, branchName: string) => {
    try {
      await checkoutBranch(repoPath, branchName);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error: any) {
      console.error('Error checking out branch:', error);
      // Preserve structured error information
      if (error.hasUncommittedChanges) {
        const structuredError = {
          message: error.message,
          hasUncommittedChanges: error.hasUncommittedChanges,
          modifiedFiles: error.modifiedFiles || []
        };
        throw structuredError;
      }
      throw error;
    }
  });

  // Stash and checkout branch
  ipcMain.handle('git:stashAndCheckout', async (_event, repoPath: string, branchName: string) => {
    try {
      await stashAndCheckout(repoPath, branchName);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error) {
      console.error('Error stashing and checking out branch:', error);
      throw error;
    }
  });

  // Discard and checkout branch
  ipcMain.handle('git:discardAndCheckout', async (_event, repoPath: string, branchName: string) => {
    try {
      await discardAndCheckout(repoPath, branchName);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error) {
      console.error('Error discarding and checking out branch:', error);
      throw error;
    }
  });

  // Merge branch
  ipcMain.handle('git:mergeBranch', async (_event, repoPath: string, branchName: string, mergeMode?: 'auto' | 'no-ff' | 'ff-only') => {
    try {
      await mergeBranch(repoPath, branchName, mergeMode);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error) {
      console.error('Error merging branch:', error);
      throw error;
    }
  });

  // Create branch
  ipcMain.handle('git:createBranch', async (_event, repoPath: string, branchName: string, startPoint?: string, switchAfterCreate?: boolean, pushAfterCreate?: boolean) => {
    try {
      await createBranch(repoPath, branchName, startPoint, switchAfterCreate, pushAfterCreate);
      const branches = await getBranches(repoPath);
      return branches;
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  });

  // Delete branch
  ipcMain.handle('git:deleteBranch', async (_event, repoPath: string, branchName: string, force: boolean) => {
    try {
      const result = await deleteBranch(repoPath, branchName, force);
      if (result.deleted) {
        const branches = await getBranches(repoPath);
        return { success: true, branches };
      } else {
        return { success: false, warning: result.warning };
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  });

  // Delete remote branch
  ipcMain.handle('git:deleteRemoteBranch', async (_event, repoPath: string, remoteName: string, branchName: string) => {
    try {
      await deleteRemoteBranch(repoPath, remoteName, branchName);
      const branches = await getBranches(repoPath);
      return branches;
    } catch (error) {
      console.error('Error deleting remote branch:', error);
      throw error;
    }
  });

  // Rename branch
  ipcMain.handle('git:renameBranch', async (_event, repoPath: string, oldName: string, newName: string, renameRemote: boolean) => {
    try {
      await renameBranch(repoPath, oldName, newName, renameRemote);
      const branches = await getBranches(repoPath);
      return branches;
    } catch (error) {
      console.error('Error renaming branch:', error);
      throw error;
    }
  });

  // Set upstream branch
  ipcMain.handle('git:setUpstreamBranch', async (_event, repoPath: string, localBranch: string, remoteName: string, remoteBranch: string) => {
    try {
      await setUpstreamBranch(repoPath, localBranch, remoteName, remoteBranch);
      const branches = await getBranches(repoPath);
      return branches;
    } catch (error) {
      console.error('Error setting upstream branch:', error);
      throw error;
    }
  });

  // Unset upstream branch
  ipcMain.handle('git:unsetUpstreamBranch', async (_event, repoPath: string, branchName: string) => {
    try {
      await unsetUpstreamBranch(repoPath, branchName);
      const branches = await getBranches(repoPath);
      return branches;
    } catch (error) {
      console.error('Error unsetting upstream branch:', error);
      throw error;
    }
  });

  // Compare branches
  ipcMain.handle('git:compareBranches', async (_event, repoPath: string, baseBranch: string, compareBranch: string) => {
    try {
      const comparison = await compareBranches(repoPath, baseBranch, compareBranch);
      return comparison;
    } catch (error) {
      console.error('Error comparing branches:', error);
      throw error;
    }
  });

  // Get reflog
  ipcMain.handle('git:getReflog', async (_event, repoPath: string, ref?: string, maxCount?: number) => {
    try {
      const reflog = await getReflog(repoPath, ref, maxCount);
      return reflog;
    } catch (error) {
      console.error('Error getting reflog:', error);
      throw error;
    }
  });

  // Reset to commit
  ipcMain.handle('git:resetToCommit', async (_event, repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard') => {
    try {
      await resetToCommit(repoPath, commitHash, mode);
    } catch (error) {
      console.error('Error resetting to commit:', error);
      throw error;
    }
  });

  // Cherry-pick commit
  ipcMain.handle('git:cherryPickCommit', async (_event, repoPath: string, commitHash: string) => {
    try {
      await cherryPickCommit(repoPath, commitHash);
    } catch (error) {
      console.error('Error cherry-picking commit:', error);
      throw error;
    }
  });

  // ==================== STASH HANDLERS ====================

  // Create stash
  ipcMain.handle('git:createStash', async (_event, repoPath: string, message?: string, includeUntracked?: boolean) => {
    try {
      await createStash(repoPath, message, includeUntracked);
    } catch (error) {
      console.error('Error creating stash:', error);
      throw error;
    }
  });

  // Get stash list
  ipcMain.handle('git:getStashList', async (_event, repoPath: string) => {
    try {
      return await getStashList(repoPath);
    } catch (error) {
      console.error('Error getting stash list:', error);
      throw error;
    }
  });

  // Apply stash
  ipcMain.handle('git:applyStash', async (_event, repoPath: string, index: number) => {
    try {
      await applyStash(repoPath, index);
    } catch (error) {
      console.error('Error applying stash:', error);
      throw error;
    }
  });

  // Pop stash
  ipcMain.handle('git:popStash', async (_event, repoPath: string, index: number) => {
    try {
      await popStash(repoPath, index);
    } catch (error) {
      console.error('Error popping stash:', error);
      throw error;
    }
  });

  // Drop stash
  ipcMain.handle('git:dropStash', async (_event, repoPath: string, index: number) => {
    try {
      await dropStash(repoPath, index);
    } catch (error) {
      console.error('Error dropping stash:', error);
      throw error;
    }
  });

  // Get stash diff
  ipcMain.handle('git:getStashDiff', async (_event, repoPath: string, index: number) => {
    try {
      return await getStashDiff(repoPath, index);
    } catch (error) {
      console.error('Error getting stash diff:', error);
      throw error;
    }
  });

  // Get stash files
  ipcMain.handle('git:getStashFiles', async (_event, repoPath: string, index: number) => {
    try {
      return await getStashFiles(repoPath, index);
    } catch (error) {
      console.error('Error getting stash files:', error);
      throw error;
    }
  });

  // Create branch from stash
  ipcMain.handle('git:createBranchFromStash', async (_event, repoPath: string, index: number, branchName: string) => {
    try {
      await createBranchFromStash(repoPath, index, branchName);
    } catch (error) {
      console.error('Error creating branch from stash:', error);
      throw error;
    }
  });

  // Clear all stashes
  ipcMain.handle('git:clearAllStashes', async (_event, repoPath: string) => {
    try {
      await clearAllStashes(repoPath);
    } catch (error) {
      console.error('Error clearing stashes:', error);
      throw error;
    }
  });

  // Get conflicted files
  ipcMain.handle('git:getConflictedFiles', async (_event, repoPath: string) => {
    try {
      return await getConflictedFiles(repoPath);
    } catch (error) {
      console.error('Error getting conflicted files:', error);
      throw error;
    }
  });

  // Get file conflicts
  ipcMain.handle('git:getFileConflicts', async (_event, repoPath: string, filePath: string) => {
    try {
      return await getFileConflicts(repoPath, filePath);
    } catch (error) {
      console.error('Error getting file conflicts:', error);
      throw error;
    }
  });

  // Resolve conflict
  ipcMain.handle('git:resolveConflict', async (_event, repoPath: string, filePath: string, resolution: 'ours' | 'theirs' | 'both', conflictIndex?: number) => {
    try {
      await resolveConflict(repoPath, filePath, resolution, conflictIndex);
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  });

  // Manually resolve conflict
  ipcMain.handle('git:resolveConflictManual', async (_event, repoPath: string, filePath: string, content: string) => {
    try {
      await resolveConflictManual(repoPath, filePath, content);
    } catch (error) {
      console.error('Error manually resolving conflict:', error);
      throw error;
    }
  });

  // Launch merge tool
  ipcMain.handle('git:launchMergeTool', async (_event, repoPath: string, filePath: string) => {
    try {
      await launchMergeTool(repoPath, filePath);
    } catch (error) {
      console.error('Error launching merge tool:', error);
      throw error;
    }
  });

  // Abort merge
  ipcMain.handle('git:abortMerge', async (_event, repoPath: string) => {
    try {
      await abortMerge(repoPath);
    } catch (error) {
      console.error('Error aborting merge:', error);
      throw error;
    }
  });

  // Continue merge
  ipcMain.handle('git:continueMerge', async (_event, repoPath: string) => {
    try {
      await continueMerge(repoPath);
    } catch (error) {
      console.error('Error continuing merge:', error);
      throw error;
    }
  });

  // Search commits
  ipcMain.handle('git:searchCommits', async (_event, repoPath: string, filter: any, limit?: number) => {
    try {
      return await searchCommits(repoPath, filter, limit);
    } catch (error) {
      console.error('Error searching commits:', error);
      throw error;
    }
  });

  // Search commits across multiple repos
  ipcMain.handle('git:searchCommitsMultiRepo', async (_event, repoPaths: string[], filter: any, limit?: number) => {
    try {
      const results = await searchCommitsMultiRepo(repoPaths, filter, limit);
      // Convert Map to Object for JSON serialization
      return Object.fromEntries(results);
    } catch (error) {
      console.error('Error searching commits in multiple repos:', error);
      throw error;
    }
  });

  // Get authors
  ipcMain.handle('git:getAuthors', async (_event, repoPath: string) => {
    try {
      return await getAuthors(repoPath);
    } catch (error) {
      console.error('Error getting authors:', error);
      throw error;
    }
  });

  // Remote management
  ipcMain.handle('git:getRemotes', async (_event, repoPath: string) => {
    try {
      return await getRemotes(repoPath);
    } catch (error) {
      console.error('Error getting remotes:', error);
      throw error;
    }
  });

  ipcMain.handle('git:addRemote', async (_event, repoPath: string, name: string, url: string) => {
    try {
      await addRemote(repoPath, name, url);
    } catch (error) {
      console.error('Error adding remote:', error);
      throw error;
    }
  });

  ipcMain.handle('git:removeRemote', async (_event, repoPath: string, name: string) => {
    try {
      await removeRemote(repoPath, name);
    } catch (error) {
      console.error('Error removing remote:', error);
      throw error;
    }
  });

  ipcMain.handle('git:renameRemote', async (_event, repoPath: string, oldName: string, newName: string) => {
    try {
      await renameRemote(repoPath, oldName, newName);
    } catch (error) {
      console.error('Error renaming remote:', error);
      throw error;
    }
  });

  ipcMain.handle('git:setRemoteUrl', async (_event, repoPath: string, name: string, url: string, isPushUrl?: boolean) => {
    try {
      await setRemoteUrl(repoPath, name, url, isPushUrl);
    } catch (error) {
      console.error('Error setting remote URL:', error);
      throw error;
    }
  });

  ipcMain.handle('git:fetchRemote', async (_event, repoPath: string, remoteName: string, prune?: boolean) => {
    try {
      await fetchRemote(repoPath, remoteName, prune);
    } catch (error) {
      console.error('Error fetching from remote:', error);
      throw error;
    }
  });

  ipcMain.handle('git:pruneRemote', async (_event, repoPath: string, remoteName: string) => {
    try {
      return await pruneRemote(repoPath, remoteName);
    } catch (error) {
      console.error('Error pruning remote:', error);
      throw error;
    }
  });

  ipcMain.handle('git:setUpstream', async (_event, repoPath: string, remoteName: string, remoteBranch: string) => {
    try {
      await setUpstream(repoPath, remoteName, remoteBranch);
    } catch (error) {
      console.error('Error setting upstream:', error);
      throw error;
    }
  });

  ipcMain.handle('git:getUpstream', async (_event, repoPath: string) => {
    try {
      return await getUpstream(repoPath);
    } catch (error) {
      console.error('Error getting upstream:', error);
      return null;
    }
  });

  // ==================== TAG MANAGEMENT ====================

  // Get all tags
  ipcMain.handle('git:getTags', async (_event, repoPath: string) => {
    try {
      return await getTags(repoPath);
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  });

  // Create lightweight tag
  ipcMain.handle('git:createLightweightTag', async (_event, repoPath: string, tagName: string, commitHash?: string) => {
    try {
      await createLightweightTag(repoPath, tagName, commitHash);
    } catch (error) {
      console.error('Error creating lightweight tag:', error);
      throw error;
    }
  });

  // Create annotated tag
  ipcMain.handle('git:createAnnotatedTag', async (_event, repoPath: string, tagName: string, message: string, commitHash?: string) => {
    try {
      await createAnnotatedTag(repoPath, tagName, message, commitHash);
    } catch (error) {
      console.error('Error creating annotated tag:', error);
      throw error;
    }
  });

  // Delete local tag
  ipcMain.handle('git:deleteTag', async (_event, repoPath: string, tagName: string) => {
    try {
      await deleteTag(repoPath, tagName);
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  });

  // Delete remote tag
  ipcMain.handle('git:deleteRemoteTag', async (_event, repoPath: string, remoteName: string, tagName: string) => {
    try {
      await deleteRemoteTag(repoPath, remoteName, tagName);
    } catch (error) {
      console.error('Error deleting remote tag:', error);
      throw error;
    }
  });

  // Push tags to remote
  ipcMain.handle('git:pushTags', async (_event, repoPath: string, remoteName: string, tagName?: string) => {
    try {
      await pushTags(repoPath, remoteName, tagName);
    } catch (error) {
      console.error('Error pushing tags:', error);
      throw error;
    }
  });

  // Checkout tag
  ipcMain.handle('git:checkoutTag', async (_event, repoPath: string, tagName: string) => {
    try {
      await checkoutTag(repoPath, tagName);
    } catch (error) {
      console.error('Error checking out tag:', error);
      throw error;
    }
  });

  // Checkout commit (detached HEAD)
  ipcMain.handle('git:checkoutCommit', async (_event, repoPath: string, commitHash: string) => {
    try {
      await checkoutCommit(repoPath, commitHash);
    } catch (error) {
      console.error('Error checking out commit:', error);
      throw error;
    }
  });

  // Get tag details
  ipcMain.handle('git:getTagDetails', async (_event, repoPath: string, tagName: string) => {
    try {
      return await getTagDetails(repoPath, tagName);
    } catch (error) {
      console.error('Error getting tag details:', error);
      throw error;
    }
  });

  // Get file content
  ipcMain.handle('git:getFileContent', async (_event, repoPath: string, filePath: string) => {
    try {
      return await getFileContent(repoPath, filePath);
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  });

  // Get file blame
  ipcMain.handle('git:getFileBlame', async (_event, repoPath: string, filePath: string) => {
    try {
      return await getFileBlame(repoPath, filePath);
    } catch (error) {
      console.error('Error getting file blame:', error);
      throw error;
    }
  });
}
