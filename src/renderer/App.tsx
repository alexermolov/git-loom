import React, { useState, useEffect } from 'react';
import { Button, message, Spin, Switch } from 'antd';
import { FolderOpenOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import IconSidebar, { ViewType } from './components/IconSidebar';
import MiddlePanel from './components/MiddlePanel';
import FileDiffPanel from './components/FileDiffPanel';
import GitGraphView from './components/GitGraphView';
import ReflogPanel from './components/ReflogPanel';
import StashDetailsPanel from './components/StashDetailsPanel';
import { RepositoryInfo, CommitInfo, BranchInfo, CommitFile, FileDiff, FileStatus, ReflogEntry, StashEntry } from './types';

const App: React.FC = () => {
  const [repositories, setRepositories] = useState<Map<string, RepositoryInfo>>(new Map());
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [hasMoreCommits, setHasMoreCommits] = useState(false);
  const [loadingMoreCommits, setLoadingMoreCommits] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scanningRepos, setScanningRepos] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repoOps, setRepoOps] = useState<Record<string, 'pull' | 'push' | undefined>>({});
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  
  // New three-panel state management
  const [activeView, setActiveView] = useState<ViewType>('commits');
  const [mainPanelView, setMainPanelView] = useState<'graph' | 'diff'>('graph');
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [showingCommitFiles, setShowingCommitFiles] = useState(false);
  const [middlePanelWidth, setMiddlePanelWidth] = useState(350);
  const [conflictCount, setConflictCount] = useState(0);
  const [selectedStash, setSelectedStash] = useState<StashEntry | null>(null);
  
  // Loading states for different panels
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingReflog, setLoadingReflog] = useState(false);
  const [loadingStash, setLoadingStash] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkTheme(true);
    }
    const savedWidth = localStorage.getItem('middlePanelWidth');
    if (savedWidth) {
      setMiddlePanelWidth(parseInt(savedWidth, 10));
    }
  }, []);

  // Toggle dark theme
  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const handleMiddlePanelResize = (newWidth: number) => {
    const clampedWidth = Math.max(200, Math.min(800, newWidth));
    setMiddlePanelWidth(clampedWidth);
    localStorage.setItem('middlePanelWidth', clampedWidth.toString());
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
            setLoadingProgress({ current: 0, total: repoPaths.length });
            
            // Параллельная загрузка всех репозиториев
            const loadPromises = repoPaths.map(async (repoPath, index) => {
              try {
                const info = await window.electronAPI.getRepositoryInfo(repoPath);
                return { repoPath, info, index };
              } catch (error) {
                console.error(`Failed to load info for ${repoPath}:`, error);
                return { repoPath, info: null, index };
              }
            });
            
            // Отслеживаем прогресс по мере завершения промисов
            let completed = 0;
            const results = await Promise.all(
              loadPromises.map(p => p.then(result => {
                completed++;
                setLoadingProgress({ current: completed, total: repoPaths.length });
                return result;
              }))
            );
            
            // Добавляем успешно загруженные репозитории
            results.forEach(({ repoPath, info }) => {
              if (info) {
                newRepos.set(repoPath, info);
              }
            });
            
            setRepositories(newRepos);
            setLoadingProgress({ current: 0, total: 0 });
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+O - Open folder
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFolder();
      }
      // Ctrl+R - Refresh
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        handleRefresh();
      }
      // Ctrl+T - Toggle theme
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [repositories, selectedRepo]);

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
      setLoadingProgress({ current: 0, total: repoPaths.length });
      
      // Параллельная загрузка всех репозиториев
      const loadPromises = repoPaths.map(async (repoPath) => {
        try {
          const info = await window.electronAPI.getRepositoryInfo(repoPath);
          return { repoPath, info };
        } catch (error) {
          console.error(`Failed to load info for ${repoPath}:`, error);
          message.error(`Failed to load info for ${repoPath}`);
          return { repoPath, info: null };
        }
      });
      
      // Отслеживаем прогресс по мере завершения промисов
      let completed = 0;
      const results = await Promise.all(
        loadPromises.map(p => p.then(result => {
          completed++;
          setLoadingProgress({ current: completed, total: repoPaths.length });
          return result;
        }))
      );
      
      // Добавляем успешно загруженные репозитории
      results.forEach(({ repoPath, info }) => {
        if (info) {
          newRepos.set(repoPath, info);
        }
      });

      setRepositories(newRepos);
      setScanningRepos(false);
      setLoadingProgress({ current: 0, total: 0 });
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

    // Параллельное обновление всех репозиториев
    const refreshPromises = Array.from(repositories.entries()).map(async ([repoPath, oldInfo]) => {
      try {
        const info = await window.electronAPI.getRepositoryInfo(repoPath);
        return { repoPath, info };
      } catch (error) {
        console.error(`Failed to refresh ${repoPath}:`, error);
        // Keep old info if refresh fails
        return { repoPath, info: oldInfo };
      }
    });
    
    const results = await Promise.all(refreshPromises);
    
    // Добавляем обновленные репозитории
    results.forEach(({ repoPath, info }) => {
      updatedRepos.set(repoPath, info);
    });

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
            window.electronAPI.getCommits(selectedRepo, undefined, 0, 25),
            window.electronAPI.getBranches(selectedRepo),
          ]);
          setCommits(commitsData);
          setHasMoreCommits(commitsData.length === 25);
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
    
    // Очистка всех данных предыдущего репозитория при переключении
    setActiveView('commits');
    setMainPanelView('graph');
    setSelectedCommit(null);
    setCommitFiles([]);
    setSelectedFile(null);
    setFileDiff(null);
    setShowingCommitFiles(false);
    setCommits([]);
    setBranches([]);
    setHasMoreCommits(false);
    setLoadingMoreCommits(false);
    setConflictCount(0);
    setSelectedStash(null);
    setCurrentBranch('');
    setLoadingBranches(false);
    setLoadingReflog(false);
    setLoadingStash(false);
    setLoadingConflicts(false);

    try {
      const repo = repositories.get(repoPath);
      if (!repo) return;

      // Load only commits initially - branches and conflicts will load on-demand
      const commitsData = await window.electronAPI.getCommits(repoPath, undefined, 0, 25);

      setCommits(commitsData);
      // Check if there are potentially more commits (if we got exactly 25, there might be more)
      setHasMoreCommits(commitsData.length === 25);
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
      // Refresh only if on commits view
      if (activeView === 'commits') {
        const commitsData = await window.electronAPI.getCommits(repoPath, undefined, 0, 25);
        setCommits(commitsData);
        setHasMoreCommits(commitsData.length === 25);
      }
      // Refresh branches if on branches view
      if (activeView === 'branches') {
        const branchesData = await window.electronAPI.getBranches(repoPath);
        setBranches(branchesData);
      }
      // Refresh conflicts if on conflicts view
      if (activeView === 'conflicts') {
        await loadConflictCount(repoPath);
      }
    } catch (error) {
      console.error('Error refreshing selected repository panels:', error);
    }
  };

  const loadConflictCount = async (repoPath: string) => {
    setLoadingConflicts(true);
    try {
      const conflictedFiles = await window.electronAPI.getConflictedFiles(repoPath);
      setConflictCount(conflictedFiles.length);
    } catch (error) {
      // Ignore errors, conflicts might not exist
      setConflictCount(0);
    } finally {
      setLoadingConflicts(false);
    }
  };

  const handleLoadMoreCommits = async () => {
    if (!selectedRepo || loadingMoreCommits || !hasMoreCommits) return;

    setLoadingMoreCommits(true);
    try {
      const newCommits = await window.electronAPI.getCommits(selectedRepo, undefined, commits.length, 25);
      
      if (newCommits.length > 0) {
        setCommits(prevCommits => [...prevCommits, ...newCommits]);
        // If we got fewer than 25 commits, we've reached the end
        setHasMoreCommits(newCommits.length === 25);
      } else {
        setHasMoreCommits(false);
      }
    } catch (error) {
      console.error('Error loading more commits:', error);
      message.error('Failed to load more commits');
    } finally {
      setLoadingMoreCommits(false);
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
    
    setSelectedCommit(commit);
    
    try {
      const files = await window.electronAPI.getCommitFiles(selectedRepo, commit.hash);
      setCommitFiles(files);
      setShowingCommitFiles(true);
    } catch (error) {
      console.error('Error loading commit files:', error);
      message.error('Failed to load commit files');
    }
  };

  const handleFileClick = async (file: CommitFile) => {
    if (!selectedRepo || !selectedCommit) return;
    
    setSelectedFile(file);
    
    try {
      const diff = await window.electronAPI.getFileDiff(selectedRepo, selectedCommit.hash, file.path);
      setFileDiff(diff);
      setMainPanelView('diff');
    } catch (error) {
      console.error('Error loading file diff:', error);
      message.error('Failed to load file diff');
    }
  };

  const handleBackToCommits = () => {
    setShowingCommitFiles(false);
    setCommitFiles([]);
    setSelectedCommit(null);
  };

  const handleReflogEntryClick = async (entry: ReflogEntry) => {
    if (!selectedRepo) return;
    
    try {
      // Load commit details for the reflog entry
      const files = await window.electronAPI.getCommitFiles(selectedRepo, entry.hash);
      setCommitFiles(files);
      
      // Create a CommitInfo object from ReflogEntry for consistency
      const commitInfo: CommitInfo = {
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author,
        refs: entry.refName,
      };
      
      setSelectedCommit(commitInfo);
      setShowingCommitFiles(true);
    } catch (error) {
      console.error('Error loading reflog entry details:', error);
      message.error('Failed to load reflog entry details');
    }
  };

  const handleViewChange = async (view: ViewType) => {
    setActiveView(view);
    
    // Reset commit files view when switching views
    if (view !== 'commits') {
      setShowingCommitFiles(false);
      setCommitFiles([]);
      setSelectedCommit(null);
    }
    
    // Reset stash selection when leaving stash view
    if (view !== 'stash') {
      setSelectedStash(null);
    }
    
    // Reset right panel state and show appropriate view for the mode
    if (view === 'graph') {
      setMainPanelView('graph');
      setFileDiff(null);
      setSelectedFile(null);
    } else if (view === 'reflog') {
      // Reflog is shown in main panel, clear diff state
      setMainPanelView('graph');
      setFileDiff(null);
      setSelectedFile(null);
    } else if (view === 'changes') {
      // For changes view, keep the diff state so clicking files shows diff in right panel
      // Don't reset fileDiff or mainPanelView
    } else {
      // For other views (branches, fileTree, commits), reset diff state
      // This ensures the right panel doesn't get stuck showing a diff
      setFileDiff(null);
      setSelectedFile(null);
      setMainPanelView('graph');
    }

    // Load data on-demand when switching to specific views
    if (!selectedRepo) return;
    
    try {
      if (view === 'branches' && branches.length === 0) {
        // Load branches only when user clicks on branches tab
        setLoadingBranches(true);
        const branchesData = await window.electronAPI.getBranches(selectedRepo);
        setBranches(branchesData);
        setLoadingBranches(false);
      } else if (view === 'conflicts') {
        // Load conflicts count when user clicks on conflicts tab
        await loadConflictCount(selectedRepo);
      }
    } catch (error) {
      console.error('Error loading view data:', error);
      setLoadingBranches(false);
      setLoadingConflicts(false);
    }
  };

  const handleChangesRefresh = async () => {
    if (!selectedRepo) return;
    
    try {
      const info = await window.electronAPI.getRepositoryInfo(selectedRepo);
      updateRepoInfo(selectedRepo, info);
      await refreshSelectedRepoPanels(selectedRepo, info);
      
      // Refresh loading states based on current view
      if (activeView === 'branches' && branches.length === 0) {
        setLoadingBranches(true);
        const branchesData = await window.electronAPI.getBranches(selectedRepo);
        setBranches(branchesData);
        setLoadingBranches(false);
      }
    } catch (error) {
      console.error('Error refreshing after changes:', error);
      setLoadingBranches(false);
    }
  };

  const handleChangedFileClick = async (file: FileStatus) => {
    if (!selectedRepo) return;
    
    try {
      const diff = await window.electronAPI.getWorkingFileDiff(selectedRepo, file.path, file.staged);
      setFileDiff(diff);
      setMainPanelView('diff');
    } catch (error) {
      console.error('Error loading file diff:', error);
      message.error('Failed to load file diff');
    }
  };

  const handleFileExplorerFileClick = async (filePath: string) => {
    if (!selectedRepo) return;
    
    try {
      // For file explorer, show file content
      const content = await window.electronAPI.getFileContent(selectedRepo, filePath);
      const diff: FileDiff = {
        path: filePath,
        diff: content,
        additions: 0,
        deletions: 0,
      };
      setFileDiff(diff);
      setMainPanelView('diff');
    } catch (error) {
      console.error('Error loading file content:', error);
      message.error('Failed to load file content');
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    if (!selectedRepo) return;
    
    try {
      const info = await window.electronAPI.checkoutBranch(selectedRepo, branchName);
      updateRepoInfo(selectedRepo, info);
      await refreshSelectedRepoPanels(selectedRepo, info);
      message.success(`Checked out branch: ${branchName}`);
    } catch (error: any) {
      console.error('Error checking out branch:', error);
      message.error(error?.message ? `Checkout failed: ${error.message}` : 'Failed to checkout branch');
    }
  };

  const handleMergeBranch = async (branchName: string) => {
    if (!selectedRepo) return;
    
    try {
      const info = await window.electronAPI.mergeBranch(selectedRepo, branchName);
      updateRepoInfo(selectedRepo, info);
      await refreshSelectedRepoPanels(selectedRepo, info);
      message.success(`Merged branch: ${branchName}`);
      
      // Check if merge created conflicts
      const conflictedFiles = await window.electronAPI.getConflictedFiles(selectedRepo);
      if (conflictedFiles.length > 0) {
        message.warning(`Merge created ${conflictedFiles.length} conflict(s). Please resolve them.`);
        setActiveView('conflicts');
      }
    } catch (error: any) {
      console.error('Error merging branch:', error);
      message.error(error?.message ? `Merge failed: ${error.message}` : 'Failed to merge branch');
      
      // Check for conflicts even on error
      if (selectedRepo) {
        await loadConflictCount(selectedRepo);
      }
    }
  };

  const handleConflictFileClick = async (filePath: string) => {
    if (!selectedRepo) return;
    
    try {
      // Get working file diff to show in the right panel
      const diff = await window.electronAPI.getWorkingFileDiff(selectedRepo, filePath, false);
      setFileDiff(diff);
      setMainPanelView('diff');
    } catch (error) {
      console.error('Error loading conflict file diff:', error);
      message.error('Failed to load file diff');
    }
  };

  const handleConflictsRefresh = async () => {
    if (!selectedRepo) return;
    
    try {
      const info = await window.electronAPI.getRepositoryInfo(selectedRepo);
      updateRepoInfo(selectedRepo, info);
      await refreshSelectedRepoPanels(selectedRepo, info);
    } catch (error) {
      console.error('Error refreshing after conflict resolution:', error);
    }
  };

  const handleStashSelect = (stash: StashEntry) => {
    setSelectedStash(stash);
  };

  const renderMainPanel = () => {
    // First priority: show file diff if requested
    if (mainPanelView === 'diff' && fileDiff) {
      return (
        <FileDiffPanel 
          diff={fileDiff} 
          onBack={() => setMainPanelView('graph')} 
          repoPath={selectedRepo}
          filePath={fileDiff.path}
          onRefresh={handleConflictsRefresh}
        />
      );
    }
    
    // Show reflog in main panel when reflog view is active
    if (activeView === 'reflog' && selectedRepo) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <ReflogPanel
            repoPath={selectedRepo}
            onEntryClick={handleReflogEntryClick}
          />
        </div>
      );
    }
    
    // Show stash details when stash is selected and view is active
    if (activeView === 'stash' && selectedRepo) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <StashDetailsPanel
            repoPath={selectedRepo}
            selectedStash={selectedStash}
          />
        </div>
      );
    }
    
    // Show git graph for normal view (when not showing diff)
    if (selectedRepo && branches.length > 0 && mainPanelView !== 'diff') {
      return <GitGraphView repoPath={selectedRepo} branches={branches} />;
    }
    
    return (
      <div className="empty-state">
        <h3>Select a repository to view the Git Graph</h3>
      </div>
    );
  };

  return (
    <div className="app-container">
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
        isDarkTheme={isDarkTheme}
        onToggleTheme={toggleTheme}
        loadingProgress={loadingProgress}
      />
      
      {!selectedRepo ? (
        <div className="main-content">
          <div className="empty-state">
            <FolderOpenOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <h2>No Repository Selected</h2>
            <p>Open a folder to scan for Git repositories</p>
            {scanningRepos && loadingProgress.total > 0 && (
              <div style={{ width: '300px', marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '14px', 
                  marginBottom: '8px',
                  color: isDarkTheme ? '#d4d4d4' : '#333'
                }}>
                  Loading repositories: {loadingProgress.current} / {loadingProgress.total} 
                  ({Math.round((loadingProgress.current / loadingProgress.total) * 100)}%)
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  backgroundColor: isDarkTheme ? '#333' : '#e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: '#1890ff',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
            <Button 
              type="primary" 
              icon={<FolderOpenOutlined />} 
              onClick={handleOpenFolder}
              loading={scanningRepos}
            >
              Open Folder
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="main-content">
          <div className="loading-state">
            <Spin size="large" tip="Loading repository data..." />
          </div>
        </div>
      ) : (
        <>
          <IconSidebar 
            activeView={activeView} 
            onViewChange={handleViewChange}
            conflictCount={conflictCount}
          />
          
          <MiddlePanel
            view={activeView}
            repoPath={selectedRepo}
            commits={commits}
            onCommitClick={handleCommitClick}
            onLoadMoreCommits={handleLoadMoreCommits}
            hasMoreCommits={hasMoreCommits}
            onChangesRefresh={handleChangesRefresh}
            onChangedFileClick={handleChangedFileClick}
            onFileExplorerFileClick={handleFileExplorerFileClick}
            branches={branches}
            currentBranch={currentBranch}
            onCheckoutBranch={handleCheckoutBranch}
            onMergeBranch={handleMergeBranch}
            commitFiles={commitFiles}
            selectedCommitHash={selectedCommit?.hash}
            onFileClick={handleFileClick}
            onReflogEntryClick={handleReflogEntryClick}
            onStashRefresh={handleChangesRefresh}
            onStashSelect={handleStashSelect}
            selectedStashIndex={selectedStash?.index ?? null}
            onConflictFileClick={handleConflictFileClick}
            onConflictsRefresh={handleConflictsRefresh}
            loadingBranches={loadingBranches}
            loadingReflog={loadingReflog}
            loadingStash={loadingStash}
            loadingConflicts={loadingConflicts}
            showingCommitFiles={showingCommitFiles}
            onBackToCommits={handleBackToCommits}
            isDarkTheme={isDarkTheme}
            width={middlePanelWidth}
            onResize={handleMiddlePanelResize}
          />
          
          <div className="main-panel">
            {renderMainPanel()}
          </div>
        </>
      )}
    </div>
  );
};

export default App;
