import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { scanForRepositories, getRepositoryInfo, getCommits, getFileTree, getBranches, getCommitFiles, getFileDiff, pullRepository, pushRepository, getGitGraph, getCommitDetails, getStatus, stageFiles, unstageFiles, createCommit, getWorkingFileDiff, checkoutBranch, mergeBranch, getReflog, resetToCommit, cherryPickCommit, getFileContent, createStash, getStashList, applyStash, popStash, dropStash, getStashDiff, getStashFiles, createBranchFromStash, clearAllStashes } from './gitService';

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
  ipcMain.handle('git:getRepositoryInfo', async (_event, repoPath: string) => {
    try {
      const info = await getRepositoryInfo(repoPath);
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
  ipcMain.handle('git:getCommits', async (_event, repoPath: string, branch?: string) => {
    try {
      const commits = await getCommits(repoPath, branch);
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
    } catch (error) {
      console.error('Error checking out branch:', error);
      throw error;
    }
  });

  // Merge branch
  ipcMain.handle('git:mergeBranch', async (_event, repoPath: string, branchName: string) => {
    try {
      await mergeBranch(repoPath, branchName);
      const info = await getRepositoryInfo(repoPath);
      return info;
    } catch (error) {
      console.error('Error merging branch:', error);
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

  // Get file content
  ipcMain.handle('git:getFileContent', async (_event, repoPath: string, filePath: string) => {
    try {
      return await getFileContent(repoPath, filePath);
    } catch (error) {
      console.error('Error getting file content:', error);
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
}
