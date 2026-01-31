import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { scanForRepositories, getRepositoryInfo, getCommits, getFileTree, getBranches, getCommitFiles, getFileDiff, pullRepository, pushRepository, getGitGraph, getCommitDetails } from './gitService';

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
}
