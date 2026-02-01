import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanRepositories: (folderPath: string) => ipcRenderer.invoke('git:scanRepositories', folderPath),
  getRepositoryInfo: (repoPath: string) => ipcRenderer.invoke('git:getRepositoryInfo', repoPath),
  pullRepository: (repoPath: string) => ipcRenderer.invoke('git:pullRepository', repoPath),
  pushRepository: (repoPath: string) => ipcRenderer.invoke('git:pushRepository', repoPath),
  getCommits: (repoPath: string, branch?: string) => ipcRenderer.invoke('git:getCommits', repoPath, branch),
  getFileTree: (repoPath: string, commitHash?: string) => ipcRenderer.invoke('git:getFileTree', repoPath, commitHash),
  getBranches: (repoPath: string) => ipcRenderer.invoke('git:getBranches', repoPath),
  getGitGraph: (repoPath: string, branch?: string) => ipcRenderer.invoke('git:getGitGraph', repoPath, branch),
  getCommitDetails: (repoPath: string, branch?: string, maxCount?: number) => ipcRenderer.invoke('git:getCommitDetails', repoPath, branch, maxCount),
  getCommitFiles: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git:getCommitFiles', repoPath, commitHash),
  getFileDiff: (repoPath: string, commitHash: string, filePath: string) => ipcRenderer.invoke('git:getFileDiff', repoPath, commitHash, filePath),
  getStatus: (repoPath: string) => ipcRenderer.invoke('git:getStatus', repoPath),
  stageFiles: (repoPath: string, filePaths: string[]) => ipcRenderer.invoke('git:stageFiles', repoPath, filePaths),
  unstageFiles: (repoPath: string, filePaths: string[]) => ipcRenderer.invoke('git:unstageFiles', repoPath, filePaths),
  createCommit: (repoPath: string, message: string) => ipcRenderer.invoke('git:createCommit', repoPath, message),
  getWorkingFileDiff: (repoPath: string, filePath: string, staged: boolean) => ipcRenderer.invoke('git:getWorkingFileDiff', repoPath, filePath, staged),
});

