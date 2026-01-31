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
});
