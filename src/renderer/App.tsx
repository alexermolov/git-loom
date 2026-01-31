import React, { useState, useEffect } from 'react';
import { Button, message, Spin, Switch } from 'antd';
import { FolderOpenOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import CommitsPanel from './components/CommitsPanel';
import BranchTreePanel from './components/BranchTreePanel';
import CommitFilesPanel from './components/CommitFilesPanel';
import FileDiffPanel from './components/FileDiffPanel';
import { RepositoryInfo, CommitInfo, BranchInfo, CommitFile, FileDiff } from './types';

const App: React.FC = () => {
  const [repositories, setRepositories] = useState<Map<string, RepositoryInfo>>(new Map());
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scanningRepos, setScanningRepos] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repoOps, setRepoOps] = useState<Record<string, 'pull' | 'push' | undefined>>({});
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  
  // Right panel state management
  const [rightPanelView, setRightPanelView] = useState<'branches' | 'commitFiles' | 'fileDiff'>('branches');
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);

  // Toggle dark theme
  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  // Auto-load last folder on startup
  useEffect(() => {
    const loadLastFolder = async () => {
      const lastFolderPath = localStorage.getItem('lastFolderPath');
      if (lastFolderPath) {
        setScanningRepos(true);
        try {
          const repoPaths = await window.electronAPI.scanRepositories(lastFolderPath);
          if (repoPaths.length > 0) {
            const newRepos = new Map<string, RepositoryInfo>();
            for (const repoPath of repoPaths) {
              try {
                const info = await window.electronAPI.getRepositoryInfo(repoPath);
                newRepos.set(repoPath, info);
              } catch (error) {
                console.error(`Failed to load info for ${repoPath}:`, error);
              }
            }
            setRepositories(newRepos);
          }
        } catch (error) {
          console.error('Error loading last folder:', error);
        } finally {
          setScanningRepos(false);
        }
      }
    };
    loadLastFolder();
  }, []);

  const handleOpenFolder = async () => {
    try {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) return;

      setScanningRepos(true);
      message.info('Scanning for repositories...');

      const repoPaths = await window.electronAPI.scanRepositories(folderPath);
      
      if (repoPaths.length === 0) {
        message.warning('No Git repositories found in the selected folder');
        setScanningRepos(false);
        return;
      }

      message.success(`Found ${repoPaths.length} repositories. Loading information...`);

      // Load info for each repository
      const newRepos = new Map<string, RepositoryInfo>();
      
      for (const repoPath of repoPaths) {
        try {
          const info = await window.electronAPI.getRepositoryInfo(repoPath);
          newRepos.set(repoPath, info);
        } catch (error) {
          console.error(`Failed to load info for ${repoPath}:`, error);
          message.error(`Failed to load info for ${repoPath}`);
        }
      }

      setRepositories(newRepos);
      setScanningRepos(false);
      message.success(`Successfully loaded ${newRepos.size} repositories`);
      
      // Save folder path to localStorage
      localStorage.setItem('lastFolderPath', folderPath);
    } catch (error) {
      console.error('Error opening folder:', error);
      message.error('Failed to open folder');
      setScanningRepos(false);
    }
  };

  const handleRefresh = async () => {
    if (repositories.size === 0) return;

    setRefreshing(true);
    message.info('Refreshing repositories...');

    const updatedRepos = new Map<string, RepositoryInfo>();

    for (const [repoPath] of repositories) {
      try {
        const info = await window.electronAPI.getRepositoryInfo(repoPath);
        updatedRepos.set(repoPath, info);
      } catch (error) {
        console.error(`Failed to refresh ${repoPath}:`, error);
        // Keep old info if refresh fails
        const oldInfo = repositories.get(repoPath);
        if (oldInfo) {
          updatedRepos.set(repoPath, oldInfo);
        }
      }
    }

    setRepositories(updatedRepos);
    setRefreshing(false);
    message.success('Repositories refreshed successfully');

    // Refresh current repo data if one is selected
    if (selectedRepo && updatedRepos.has(selectedRepo)) {
      const repo = updatedRepos.get(selectedRepo);
      if (repo) {
        setCurrentBranch(repo.currentBranch);
        // Reload commits and branches
        try {
          const [commitsData, branchesData] = await Promise.all([
            window.electronAPI.getCommits(selectedRepo),
            window.electronAPI.getBranches(selectedRepo),
          ]);
          setCommits(commitsData);
          setBranches(branchesData);
        } catch (error) {
          console.error('Error refreshing selected repository:', error);
        }
      }
    }
  };

  const handleSelectRepository = async (repoPath: string) => {
    setSelectedRepo(repoPath);
    setLoading(true);
    setRightPanelView('branches');
    setSelectedCommit(null);
    setCommitFiles([]);
    setSelectedFile(null);
    setFileDiff(null);

    try {
      const repo = repositories.get(repoPath);
      if (!repo) return;

      // Load commits and branches in parallel
      const [commitsData, branchesData] = await Promise.all([
        window.electronAPI.getCommits(repoPath),
        window.electronAPI.getBranches(repoPath),
      ]);

      setCommits(commitsData);
      setBranches(branchesData);
      setCurrentBranch(repo.currentBranch);
    } catch (error) {
      console.error('Error loading repository data:', error);
      message.error('Failed to load repository data');
    } finally {
      setLoading(false);
    }
  };

  const updateRepoInfo = (repoPath: string, info: RepositoryInfo) => {
    setRepositories((prev) => {
      const next = new Map(prev);
      next.set(repoPath, info);
      return next;
    });
  };

  const refreshSelectedRepoPanels = async (repoPath: string, info: RepositoryInfo) => {
    if (selectedRepo !== repoPath) return;

    setCurrentBranch(info.currentBranch);
    try {
      const [commitsData, branchesData] = await Promise.all([
        window.electronAPI.getCommits(repoPath),
        window.electronAPI.getBranches(repoPath),
      ]);
      setCommits(commitsData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error refreshing selected repository panels:', error);
    }
  };

  const clearRepoOp = (repoPath: string) => {
    setRepoOps((prev) => {
      const next = { ...prev };
      delete next[repoPath];
      return next;
    });
  };

  const handlePullRepository = async (repoPath: string) => {
    if (repoOps[repoPath]) return;

    setRepoOps((prev) => ({ ...prev, [repoPath]: 'pull' }));
    try {
      const info = await window.electronAPI.pullRepository(repoPath);
      updateRepoInfo(repoPath, info);
      await refreshSelectedRepoPanels(repoPath, info);
      message.success('Pull completed');
    } catch (error: any) {
      console.error('Pull failed:', error);
      message.error(error?.message ? `Pull failed: ${error.message}` : 'Pull failed');
    } finally {
      clearRepoOp(repoPath);
    }
  };

  const handlePushRepository = async (repoPath: string) => {
    if (repoOps[repoPath]) return;

    setRepoOps((prev) => ({ ...prev, [repoPath]: 'push' }));
    try {
      const info = await window.electronAPI.pushRepository(repoPath);
      updateRepoInfo(repoPath, info);
      await refreshSelectedRepoPanels(repoPath, info);
      message.success('Push completed');
    } catch (error: any) {
      console.error('Push failed:', error);
      message.error(error?.message ? `Push failed: ${error.message}` : 'Push failed');
    } finally {
      clearRepoOp(repoPath);
    }
  };

  const handleCommitClick = async (commit: CommitInfo) => {
    if (!selectedRepo) return;
    
    setLoading(true);
    setSelectedCommit(commit);
    
    try {
      const files = await window.electronAPI.getCommitFiles(selectedRepo, commit.hash);
      setCommitFiles(files);
      setRightPanelView('commitFiles');
    } catch (error) {
      console.error('Error loading commit files:', error);
      message.error('Failed to load commit files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file: CommitFile) => {
    if (!selectedRepo || !selectedCommit) return;
    
    setLoading(true);
    setSelectedFile(file);
    
    try {
      const diff = await window.electronAPI.getFileDiff(selectedRepo, selectedCommit.hash, file.path);
      setFileDiff(diff);
      setRightPanelView('fileDiff');
    } catch (error) {
      console.error('Error loading file diff:', error);
      message.error('Failed to load file diff');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToBranches = () => {
    setRightPanelView('branches');
    setSelectedCommit(null);
    setCommitFiles([]);
    setSelectedFile(null);
    setFileDiff(null);
  };

  const handleBackToFiles = () => {
    setRightPanelView('commitFiles');
    setSelectedFile(null);
    setFileDiff(null);
  };

  return (
    <div className="app-container">
      <Button 
        className="theme-toggle"
        icon={isDarkTheme ? <BulbFilled /> : <BulbOutlined />}
        onClick={toggleTheme}
        type="text"
        size="large"
        style={{ color: isDarkTheme ? '#ffd700' : '#666', left: 16, right: 'auto', top: 16, position: 'fixed' }}
      >
        {isDarkTheme ? 'Light' : 'Dark'}
      </Button>
      
      <Sidebar
        repositories={Array.from(repositories.values())}
        selectedRepo={selectedRepo}
        onSelectRepo={handleSelectRepository}
        onOpenFolder={handleOpenFolder}
        onRefresh={handleRefresh}
        onPullRepo={handlePullRepository}
        onPushRepo={handlePushRepository}
        repoOps={repoOps}
        scanning={scanningRepos}
        refreshing={refreshing}
      />
      
      <div className="main-content">
        {!selectedRepo ? (
          <div className="empty-state">
            <FolderOpenOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <h2>No Repository Selected</h2>
            <p>Open a folder to scan for Git repositories</p>
            <Button 
              type="primary" 
              icon={<FolderOpenOutlined />} 
              onClick={handleOpenFolder}
              loading={scanningRepos}
            >
              Open Folder
            </Button>
          </div>
        ) : loading ? (
          <div className="loading-state">
            <Spin size="large" tip="Loading repository data..." />
          </div>
        ) : (
          <div className="content-area">
            <CommitsPanel commits={commits} onCommitClick={handleCommitClick} />
            {rightPanelView === 'branches' && (
              <BranchTreePanel repoPath={selectedRepo} branches={branches} currentBranch={currentBranch} />
            )}
            {rightPanelView === 'commitFiles' && (
              <CommitFilesPanel 
                files={commitFiles} 
                commitHash={selectedCommit?.hash || ''}
                onBack={handleBackToBranches}
                onFileClick={handleFileClick}
              />
            )}
            {rightPanelView === 'fileDiff' && (
              <FileDiffPanel 
                diff={fileDiff}
                onBack={handleBackToFiles}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
