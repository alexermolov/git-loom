import { FolderOpenOutlined } from "@ant-design/icons";
import { App as AntApp, Button, message, Spin } from "antd";
import React, { useEffect, useState } from "react";
import { useTheme } from "./ThemeContext";
import FileDiffPanel from "./components/FileDiffPanel";
import FileEditorPanel from "./components/FileEditorPanel";
import FileHistoryPanel from "./components/FileHistoryPanel";
import GitGraphView from "./components/GitGraphView";
import IconSidebar, { ViewType } from "./components/IconSidebar";
import InteractiveRebasePanel from "./components/InteractiveRebasePanel";
import MiddlePanel from "./components/MiddlePanel";
import ReflogPanel from "./components/ReflogPanel";
import RemoteManagementPanel from "./components/RemoteManagementPanel";
import Sidebar from "./components/Sidebar";
import StashDetailsPanel from "./components/StashDetailsPanel";
import TagsPanel from "./components/TagsPanel";
import {
  BranchInfo,
  CommitFile,
  CommitInfo,
  FileDiff,
  FileStatus,
  ReflogEntry,
  RepositoryInfo,
  StashEntry,
} from "./types";

type MainPanelView = "graph" | "diff" | "editor" | "fileHistory";

type NavigationSnapshot = {
  activeView: ViewType;
  mainPanelView: MainPanelView;
  selectedCommit: CommitInfo | null;
  commitFiles: CommitFile[];
  selectedFile: CommitFile | null;
  fileDiff: FileDiff | null;
  showingCommitFiles: boolean;
  selectedExplorerFile: string | null;
  selectedHistoryFile: string | null;
  selectedStash: StashEntry | null;
};

type BackLabelDefaults = {
  commitFiles: string;
  diff: string;
  editor: string;
  fileHistory: string;
};

const App: React.FC = () => {
  const { modal } = AntApp.useApp();
  const [repositories, setRepositories] = useState<Map<string, RepositoryInfo>>(
    new Map(),
  );
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [hasMoreCommits, setHasMoreCommits] = useState(false);
  const [loadingMoreCommits, setLoadingMoreCommits] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [scanningRepos, setScanningRepos] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repoOps, setRepoOps] = useState<
    Record<string, "pull" | "push" | undefined>
  >({});
  const [loadingProgress, setLoadingProgress] = useState({
    current: 0,
    total: 0,
  });

  // Use theme context
  const { isDarkMode, toggleTheme } = useTheme();

  // New three-panel state management
  const [activeView, setActiveView] = useState<ViewType>("commits");
  const [mainPanelView, setMainPanelView] = useState<MainPanelView>("graph");
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [showingCommitFiles, setShowingCommitFiles] = useState(false);
  const [loadingFileDiff, setLoadingFileDiff] = useState(false);
  const [middlePanelWidth, setMiddlePanelWidth] = useState(350);
  const [conflictCount, setConflictCount] = useState(0);
  const [selectedStash, setSelectedStash] = useState<StashEntry | null>(null);
  const [graphRefreshToken, setGraphRefreshToken] = useState(0);
  const [conflictRefreshToken, setConflictRefreshToken] = useState(0);

  // File explorer state
  const [selectedExplorerFile, setSelectedExplorerFile] = useState<
    string | null
  >(null);

  // File history state
  const [selectedHistoryFile, setSelectedHistoryFile] = useState<string | null>(
    null,
  );
  const [navigationStack, setNavigationStack] = useState<NavigationSnapshot[]>(
    [],
  );

  // Loading states for different panels
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingReflog, setLoadingReflog] = useState(false);
  const [loadingStash, setLoadingStash] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  // Load saved panel width
  useEffect(() => {
    const savedWidth = localStorage.getItem("middlePanelWidth");
    if (savedWidth) {
      setMiddlePanelWidth(parseInt(savedWidth, 10));
    }
  }, []);

  const handleMiddlePanelResize = (newWidth: number) => {
    const clampedWidth = Math.max(200, Math.min(800, newWidth));
    setMiddlePanelWidth(clampedWidth);
    localStorage.setItem("middlePanelWidth", clampedWidth.toString());
  };

  const captureNavigationSnapshot = (): NavigationSnapshot => ({
    activeView,
    mainPanelView,
    selectedCommit,
    commitFiles,
    selectedFile,
    fileDiff,
    showingCommitFiles,
    selectedExplorerFile,
    selectedHistoryFile,
    selectedStash,
  });

  const applyNavigationSnapshot = (snapshot: NavigationSnapshot) => {
    setActiveView(snapshot.activeView);
    setMainPanelView(snapshot.mainPanelView);
    setSelectedCommit(snapshot.selectedCommit);
    setCommitFiles(snapshot.commitFiles);
    setSelectedFile(snapshot.selectedFile);
    setFileDiff(snapshot.fileDiff);
    setShowingCommitFiles(snapshot.showingCommitFiles);
    setSelectedExplorerFile(snapshot.selectedExplorerFile);
    setSelectedHistoryFile(snapshot.selectedHistoryFile);
    setSelectedStash(snapshot.selectedStash);
  };

  const pushNavigationSnapshot = () => {
    setNavigationStack((prev) => [...prev, captureNavigationSnapshot()]);
  };

  const goBackInNavigation = (
    fallback?: () => void,
  ) => {
    const previousSnapshot = navigationStack[navigationStack.length - 1];

    if (!previousSnapshot) {
      fallback?.();
      return;
    }

    setNavigationStack((prev) => prev.slice(0, -1));
    applyNavigationSnapshot(previousSnapshot);
  };

  const getSnapshotDisplayName = (snapshot: NavigationSnapshot): string => {
    if (snapshot.showingCommitFiles) {
      return "Commit Files";
    }

    if (snapshot.mainPanelView === "fileHistory") {
      return "File Timeline";
    }

    if (snapshot.mainPanelView === "editor") {
      return "File Editor";
    }

    if (snapshot.mainPanelView === "diff") {
      return "Files";
    }

    switch (snapshot.activeView) {
      case "commits":
        return "Commits";
      case "changes":
        return "Changes";
      case "fileTree":
        return "File Explorer";
      case "branches":
        return "Branches";
      case "reflog":
        return "Reflog";
      case "stash":
        return "Stash";
      case "conflicts":
        return "Conflicts";
      case "rebase":
        return "Rebase";
      case "remotes":
        return "Remotes";
      case "tags":
        return "Tags";
      case "graph":
      default:
        return "Graph";
    }
  };

  const getBackLabels = (): BackLabelDefaults => {
    const previousSnapshot = navigationStack[navigationStack.length - 1];
    const destinationLabel = previousSnapshot
      ? getSnapshotDisplayName(previousSnapshot)
      : null;

    return {
      commitFiles: destinationLabel
        ? `Back to ${destinationLabel}`
        : "Back to Commits",
      diff: destinationLabel ? `Back to ${destinationLabel}` : "Back to Files",
      editor: destinationLabel ? `Back to ${destinationLabel}` : "Back",
      fileHistory: destinationLabel ? `Back to ${destinationLabel}` : "Back",
    };
  };

  const openCommitDetails = async (
    commitInfo: CommitInfo,
    options?: {
      pushHistory?: boolean;
      targetActiveView?: ViewType;
      clearDetailPanels?: boolean;
    },
  ) => {
    if (!selectedRepo) return;

    if (options?.pushHistory !== false) {
      pushNavigationSnapshot();
    }

    if (options?.targetActiveView) {
      setActiveView(options.targetActiveView);
    }

    if (options?.clearDetailPanels) {
      setMainPanelView("graph");
      setSelectedExplorerFile(null);
      setSelectedHistoryFile(null);
      setFileDiff(null);
      setSelectedFile(null);
    }

    setSelectedCommit(commitInfo);

    try {
      const files = await window.electronAPI.getCommitFiles(
        selectedRepo,
        commitInfo.hash,
      );
      setCommitFiles(files);
      setShowingCommitFiles(true);
    } catch (error) {
      console.error("Error loading commit files:", error);
      message.error("Failed to load commit files");
    }
  };

  // Auto-load last folder on startup
  useEffect(() => {
    const loadLastFolder = async () => {
      const lastFolderPath = localStorage.getItem("lastFolderPath");
      if (lastFolderPath) {
        setScanningRepos(true);
        try {
          const repoPaths =
            await window.electronAPI.scanRepositories(lastFolderPath);
          if (repoPaths.length > 0) {
            const newRepos = new Map<string, RepositoryInfo>();
            setLoadingProgress({ current: 0, total: repoPaths.length });

            // Параллельная загрузка всех репозиториев
            const loadPromises = repoPaths.map(async (repoPath, index) => {
              try {
                const info =
                  await window.electronAPI.getRepositoryInfo(repoPath);
                return { repoPath, info, index };
              } catch (error) {
                console.error(`Failed to load info for ${repoPath}:`, error);
                return { repoPath, info: null, index };
              }
            });

            // Отслеживаем прогресс по мере завершения промисов
            let completed = 0;
            const results = await Promise.all(
              loadPromises.map((p) =>
                p.then((result) => {
                  completed++;
                  setLoadingProgress({
                    current: completed,
                    total: repoPaths.length,
                  });
                  return result;
                }),
              ),
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
          console.error("Error loading last folder:", error);
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
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        handleOpenFolder();
      }
      // Ctrl+R - Refresh
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }
      // Ctrl+T - Toggle theme
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [repositories, selectedRepo]);

  const handleOpenFolder = async () => {
    try {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) return;

      setScanningRepos(true);
      message.info("Scanning for repositories...");

      const repoPaths = await window.electronAPI.scanRepositories(folderPath);

      if (repoPaths.length === 0) {
        message.warning("No Git repositories found in the selected folder");
        setScanningRepos(false);
        return;
      }

      message.success(
        `Found ${repoPaths.length} repositories. Loading information...`,
      );

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
        loadPromises.map((p) =>
          p.then((result) => {
            completed++;
            setLoadingProgress({ current: completed, total: repoPaths.length });
            return result;
          }),
        ),
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
      localStorage.setItem("lastFolderPath", folderPath);
    } catch (error) {
      console.error("Error opening folder:", error);
      message.error("Failed to open folder");
      setScanningRepos(false);
    }
  };

  const handleRefresh = async () => {
    if (repositories.size === 0) return;

    setRefreshing(true);
    message.info("Refreshing repositories...");

    const updatedRepos = new Map<string, RepositoryInfo>();

    // Параллельное обновление всех репозиториев
    const refreshPromises = Array.from(repositories.entries()).map(
      async ([repoPath, oldInfo]) => {
        try {
          const info = await window.electronAPI.getRepositoryInfo(
            repoPath,
            true,
          );
          return { repoPath, info };
        } catch (error) {
          console.error(`Failed to refresh ${repoPath}:`, error);
          // Keep old info if refresh fails
          return { repoPath, info: oldInfo };
        }
      },
    );

    const results = await Promise.all(refreshPromises);

    // Добавляем обновленные репозитории
    results.forEach(({ repoPath, info }) => {
      updatedRepos.set(repoPath, info);
    });

    setRepositories(updatedRepos);
    setRefreshing(false);
    message.success("Repositories refreshed successfully");

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
          bumpGraphRefresh();
        } catch (error) {
          console.error("Error refreshing selected repository:", error);
        }
      }
    }
  };

  const handleSelectRepository = async (repoPath: string) => {
    setSelectedRepo(repoPath);
    setLoading(true);
    setNavigationStack([]);

    // Очистка всех данных предыдущего репозитория при переключении
    setActiveView("commits");
    setMainPanelView("graph");
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
    setCurrentBranch("");
    setLoadingBranches(false);
    setLoadingReflog(false);
    setLoadingStash(false);
    setLoadingConflicts(false);
    try {
      const repo = repositories.get(repoPath);
      if (!repo) return;

      // Load commits + branches + conflicts сразу (чтобы счетчик конфликтов обновился мгновенно при выборе репозитория и отобразился Git Graph)
      const [commitsData, branchesData] = await Promise.all([
        window.electronAPI.getCommits(repoPath, undefined, 0, 25),
        window.electronAPI.getBranches(repoPath),
        loadConflictCount(repoPath),
      ]);

      setCommits(commitsData);
      setBranches(branchesData);
      // Check if there are potentially more commits (if we got exactly 25, there might be more)
      setHasMoreCommits(commitsData.length === 25);
      setCurrentBranch(repo.currentBranch);
    } catch (error) {
      console.error("Error loading repository data:", error);
      message.error("Failed to load repository data");
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

  const refreshSelectedRepoPanels = async (
    repoPath: string,
    info: RepositoryInfo,
  ) => {
    if (selectedRepo !== repoPath) return;

    setCurrentBranch(info.currentBranch);
    try {
      // Refresh only if on commits view
      if (activeView === "commits") {
        const commitsData = await window.electronAPI.getCommits(
          repoPath,
          undefined,
          0,
          25,
        );
        setCommits(commitsData);
        setHasMoreCommits(commitsData.length === 25);
      }
      // Refresh branches if on branches view
      if (activeView === "branches") {
        const branchesData = await window.electronAPI.getBranches(repoPath);
        setBranches(branchesData);
      }
      // Refresh conflicts if on conflicts view
      if (activeView === "conflicts") {
        await loadConflictCount(repoPath);
      }
    } catch (error) {
      console.error("Error refreshing selected repository panels:", error);
    }
  };

  const loadConflictCount = async (repoPath: string) => {
    setLoadingConflicts(true);
    try {
      const conflictedFiles =
        await window.electronAPI.getConflictedFiles(repoPath);
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
      const newCommits = await window.electronAPI.getCommits(
        selectedRepo,
        undefined,
        commits.length,
        25,
      );

      if (newCommits.length > 0) {
        setCommits((prevCommits) => {
          const existingHashes = new Set(
            prevCommits.map((commit) => commit.hash),
          );
          const uniqueNewCommits = newCommits.filter(
            (commit) => !existingHashes.has(commit.hash),
          );

          return [...prevCommits, ...uniqueNewCommits];
        });
        // If we got fewer than 25 commits, we've reached the end
        setHasMoreCommits(newCommits.length === 25);
      } else {
        setHasMoreCommits(false);
      }
    } catch (error) {
      console.error("Error loading more commits:", error);
      message.error("Failed to load more commits");
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

    setRepoOps((prev) => ({ ...prev, [repoPath]: "pull" }));
    try {
      const info = await window.electronAPI.pullRepository(repoPath);
      updateRepoInfo(repoPath, info);
      await refreshSelectedRepoPanels(repoPath, info);
      if (repoPath === selectedRepo) {
        bumpGraphRefresh();
      }
      message.success("Pull completed");
    } catch (error: any) {
      console.error("Pull failed:", error);
      message.error(
        error?.message ? `Pull failed: ${error.message}` : "Pull failed",
      );
    } finally {
      clearRepoOp(repoPath);
    }
  };

  const isNonFastForwardPushError = (err: any) => {
    const msg = (err?.message || String(err || "")).toLowerCase();
    return (
      msg.includes("non-fast-forward") ||
      msg.includes("fetch first") ||
      msg.includes("updates were rejected") ||
      (msg.includes("rejected") && msg.includes("fast-forward"))
    );
  };

  const handlePushRepository = async (
    repoPath: string,
    options?: { force?: boolean; forceWithLease?: boolean },
  ) => {
    if (repoOps[repoPath]) return;

    setRepoOps((prev) => ({ ...prev, [repoPath]: "push" }));
    try {
      const info = await window.electronAPI.pushRepository(repoPath, options);
      updateRepoInfo(repoPath, info);
      await refreshSelectedRepoPanels(repoPath, info);
      if (repoPath === selectedRepo) {
        bumpGraphRefresh();
      }
      message.success("Push completed");
    } catch (error: any) {
      console.error("Push failed:", error);
      if (!options && isNonFastForwardPushError(error)) {
        modal.confirm({
          title: "Push rejected (non-fast-forward)",
          content: (
            <div>
              <p>
                Remote has commits your local history no longer fast-forwards
                to. This is expected after an interactive rebase.
              </p>
              <p>Recommended: force push with lease (safer than -f).</p>
            </div>
          ),
          okText: "Force Push (with lease)",
          cancelText: "Cancel",
          onOk: async () => {
            try {
              await handlePushRepository(repoPath, { forceWithLease: true });
            } catch (leaseErr: any) {
              // If lease fails (remote moved), optionally allow plain -f.
              if (
                isNonFastForwardPushError(leaseErr) ||
                (leaseErr?.message || "").toLowerCase().includes("stale")
              ) {
                modal.confirm({
                  title: "Force-with-lease failed",
                  content: (
                    <div>
                      <p>
                        The remote branch changed since your last fetch. You can
                        retry with plain force push (-f), but it may overwrite
                        others' work.
                      </p>
                    </div>
                  ),
                  okText: "Force Push (-f)",
                  okType: "danger",
                  cancelText: "Cancel",
                  onOk: async () => {
                    await handlePushRepository(repoPath, { force: true });
                  },
                });
              } else {
                message.error(
                  leaseErr?.message
                    ? `Push failed: ${leaseErr.message}`
                    : "Push failed",
                );
              }
            }
          },
        });
        return;
      }

      message.error(
        error?.message ? `Push failed: ${error.message}` : "Push failed",
      );
    } finally {
      clearRepoOp(repoPath);
    }
  };

  const handleCommitClick = async (commit: CommitInfo) => {
    await openCommitDetails(commit);
  };

  const handleGraphCommitClick = async (
    commitHash: string,
    messageText?: string,
  ) => {
    const commitInfo: CommitInfo = {
      hash: commitHash,
      date: "",
      message: messageText ?? "",
      author: "",
      refs: "",
    };

    await openCommitDetails(commitInfo);
  };

  const handleFileClick = async (file: CommitFile) => {
    if (!selectedRepo || !selectedCommit) return;

    pushNavigationSnapshot();
    setSelectedFile(file);
    setLoadingFileDiff(true);
    setMainPanelView("diff");

    try {
      const diff = await window.electronAPI.getFileDiff(
        selectedRepo,
        selectedCommit.hash,
        file.path,
      );

      console.log("Loaded diff for regular commit:", {
        path: file.path,
        commitHash: selectedCommit.hash,
        diffLength: diff.diff?.length,
        diffPreview: diff.diff?.substring(0, 200),
        additions: diff.additions,
        deletions: diff.deletions,
      });

      // Report degraded cases without claiming the file is actually empty.
      if (!diff.diff || diff.diff.trim() === "") {
        if (file.status === "added") {
          message.info("Patch unavailable for the added file");
        } else if (file.status === "deleted") {
          message.info("Patch unavailable for the deleted file");
        } else {
          message.warning("Patch unavailable for this file");
        }
      }

      setFileDiff(diff);
    } catch (error) {
      console.error("Error loading file diff:", error);
      message.error("Failed to load file diff");
      // Clear diff on error to show empty state
      setFileDiff(null);
    } finally {
      setLoadingFileDiff(false);
    }
  };

  const handleBackToCommits = () => {
    goBackInNavigation(() => {
      setShowingCommitFiles(false);
      setCommitFiles([]);
      setSelectedCommit(null);
    });
  };

  const handleReflogEntryClick = async (entry: ReflogEntry) => {
    const commitInfo: CommitInfo = {
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author,
      refs: entry.refName,
    };

    await openCommitDetails(commitInfo);
  };

  const handleViewChange = async (view: ViewType) => {
    setNavigationStack([]);
    setActiveView(view);

    // Reset commit files view when switching views
    if (view !== "commits") {
      setShowingCommitFiles(false);
      setCommitFiles([]);
      setSelectedCommit(null);
    }

    // Reset stash selection when leaving stash view
    if (view !== "stash") {
      setSelectedStash(null);
    }

    // Reset right panel state and show appropriate view for the mode
    if (view === "graph") {
      setMainPanelView("graph");
      setFileDiff(null);
      setSelectedFile(null);
    } else if (view === "reflog") {
      // Reflog is shown in main panel, clear diff state
      setMainPanelView("graph");
      setFileDiff(null);
      setSelectedFile(null);
    } else if (view === "changes") {
      // For changes view, keep the diff state so clicking files shows diff in right panel
      // Don't reset fileDiff or mainPanelView
    } else {
      // For other views (branches, fileTree, commits), reset diff state
      // This ensures the right panel doesn't get stuck showing a diff
      setFileDiff(null);
      setSelectedFile(null);
      setMainPanelView("graph");
    }

    // Load data on-demand when switching to specific views
    if (!selectedRepo) return;

    try {
      if ((view === "branches" || view === "rebase") && branches.length === 0) {
        // Load branches only when needed (e.g. branches tab or rebase panel)
        setLoadingBranches(true);
        const branchesData = await window.electronAPI.getBranches(selectedRepo);
        setBranches(branchesData);
        setLoadingBranches(false);
      } else if (view === "conflicts") {
        // Load conflicts count when user clicks on conflicts tab
        await loadConflictCount(selectedRepo);
      }
    } catch (error) {
      console.error("Error loading view data:", error);
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
      if (activeView === "branches" && branches.length === 0) {
        setLoadingBranches(true);
        const branchesData = await window.electronAPI.getBranches(selectedRepo);
        setBranches(branchesData);
        setLoadingBranches(false);
      }

      // Refresh git graph as changes may affect history (e.g., creating branch from stash)
      bumpGraphRefresh();
    } catch (error) {
      console.error("Error refreshing after changes:", error);
      setLoadingBranches(false);
    }
  };

  const handleChangedFileClick = async (file: FileStatus) => {
    if (!selectedRepo) return;

    try {
      pushNavigationSnapshot();
      const diff = await window.electronAPI.getWorkingFileDiff(
        selectedRepo,
        file.path,
        file.staged,
      );
      setFileDiff(diff);
      setMainPanelView("diff");
    } catch (error) {
      console.error("Error loading file diff:", error);
      message.error("Failed to load file diff");
    }
  };

  const handleFileExplorerFileClick = async (filePath: string) => {
    if (!selectedRepo) return;

    // Set the file to view in the FileEditorPanel
    pushNavigationSnapshot();
    setSelectedExplorerFile(filePath);
    setMainPanelView("editor");
  };

  const handleFileHistoryClick = (filePath: string) => {
    if (!selectedRepo) return;

    pushNavigationSnapshot();
    setSelectedHistoryFile(filePath);
    setMainPanelView("fileHistory");
  };

  const handleBackFromFileHistory = () => {
    goBackInNavigation(() => {
      setSelectedHistoryFile(null);
      setMainPanelView("graph");
    });
  };

  const handleCheckoutBranch = async (branchName: string) => {
    if (!selectedRepo) return;

    try {
      const info = await window.electronAPI.checkoutBranch(
        selectedRepo,
        branchName,
      );
      updateRepoInfo(selectedRepo, info);
      await refreshSelectedRepoPanels(selectedRepo, info);
      bumpGraphRefresh();
      message.success(`Checked out branch: ${branchName}`);
    } catch (error: any) {
      console.error("Error checking out branch:", error);
      // Show error message for normal checkout (not from BranchSwitcher)
      if (error?.hasUncommittedChanges) {
        message.error(
          `Cannot checkout: you have ${error.modifiedFiles?.length || 0} uncommitted file(s). Please commit or stash them first.`,
        );
      } else {
        message.error(
          error?.message
            ? `Checkout failed: ${error.message}`
            : "Failed to checkout branch",
        );
      }
    }
  };

  const handleBranchSwitch = async (repoPath: string, branchName: string) => {
    try {
      const info = await window.electronAPI.checkoutBranch(
        repoPath,
        branchName,
      );
      updateRepoInfo(repoPath, info);

      // If this is the selected repo, refresh panels
      if (repoPath === selectedRepo) {
        await refreshSelectedRepoPanels(repoPath, info);
        bumpGraphRefresh();
      }
    } catch (error: any) {
      console.error("Error switching branch:", error);
      // Re-throw to let BranchSwitcher handle it
      throw error;
    }
  };

  const handleStashAndSwitch = async (repoPath: string, branchName: string) => {
    try {
      const info = await window.electronAPI.stashAndCheckout(
        repoPath,
        branchName,
      );
      updateRepoInfo(repoPath, info);

      // If this is the selected repo, refresh panels
      if (repoPath === selectedRepo) {
        await refreshSelectedRepoPanels(repoPath, info);
        bumpGraphRefresh();
      }
    } catch (error: any) {
      console.error("Error stashing and switching branch:", error);
      throw error;
    }
  };

  const handleDiscardAndSwitch = async (
    repoPath: string,
    branchName: string,
  ) => {
    try {
      const info = await window.electronAPI.discardAndCheckout(
        repoPath,
        branchName,
      );
      updateRepoInfo(repoPath, info);

      // If this is the selected repo, refresh panels
      if (repoPath === selectedRepo) {
        await refreshSelectedRepoPanels(repoPath, info);
        bumpGraphRefresh();
      }
    } catch (error: any) {
      console.error("Error discarding and switching branch:", error);
      throw error;
    }
  };

  const handleMergeBranch = async (
    branchName: string,
    mergeMode: "auto" | "no-ff" | "ff-only" = "no-ff",
  ) => {
    if (!selectedRepo) return;

    try {
      const info = await window.electronAPI.mergeBranch(
        selectedRepo,
        branchName,
        mergeMode,
      );
      updateRepoInfo(selectedRepo, info);

      // Force refresh commits after merge
      const commitsData = await window.electronAPI.getCommits(
        selectedRepo,
        undefined,
        0,
        25,
      );
      setCommits(commitsData);
      setHasMoreCommits(commitsData.length === 25);

      // Refresh branches
      const branchesData = await window.electronAPI.getBranches(selectedRepo);
      setBranches(branchesData);

      await refreshSelectedRepoPanels(selectedRepo, info);
      bumpGraphRefresh();
      message.success(`Merged branch: ${branchName}`);

      // Check if merge created conflicts
      const conflictedFiles =
        await window.electronAPI.getConflictedFiles(selectedRepo);
      if (conflictedFiles.length > 0) {
        message.warning(
          `Merge created ${conflictedFiles.length} conflict(s). Please resolve them.`,
        );
        setActiveView("conflicts");
      }
    } catch (error: any) {
      console.error("Error merging branch:", error);
      message.error(
        error?.message
          ? `Merge failed: ${error.message}`
          : "Failed to merge branch",
      );

      // Check for conflicts even on error
      if (selectedRepo) {
        await loadConflictCount(selectedRepo);
      }
    }
  };

  const handleBranchesRefresh = async () => {
    if (!selectedRepo) return;

    try {
      setLoadingBranches(true);
      const [branchesData, info] = await Promise.all([
        window.electronAPI.getBranches(selectedRepo),
        window.electronAPI.getRepositoryInfo(selectedRepo),
      ]);
      setBranches(branchesData);
      setCurrentBranch(info.currentBranch);
      updateRepoInfo(selectedRepo, info);
      bumpGraphRefresh();
    } catch (error: any) {
      console.error("Error refreshing branches:", error);
      message.error("Failed to refresh branches");
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleConflictFileClick = async (filePath: string) => {
    if (!selectedRepo) return;

    try {
      // Get working file diff to show in the right panel
      pushNavigationSnapshot();
      const diff = await window.electronAPI.getWorkingFileDiff(
        selectedRepo,
        filePath,
        false,
      );
      setFileDiff(diff);
      setMainPanelView("diff");
    } catch (error) {
      console.error("Error loading conflict file diff:", error);
      message.error("Failed to load file diff");
    }
  };

  const handleConflictsRefresh = async () => {
    if (!selectedRepo) return;

    try {
      const info = await window.electronAPI.getRepositoryInfo(selectedRepo);
      updateRepoInfo(selectedRepo, info);
      await refreshSelectedRepoPanels(selectedRepo, info);
      bumpGraphRefresh();
      // Trigger conflict list refresh
      setConflictRefreshToken((prev) => prev + 1);
    } catch (error) {
      console.error("Error refreshing after conflict resolution:", error);
    }
  };

  const handleAllConflictsResolved = async () => {
    if (!selectedRepo) return;

    try {
      // Check if we're currently in a rebase operation
      const rebaseStatus =
        await window.electronAPI.getRebaseStatus(selectedRepo);

      if (rebaseStatus.inProgress && !rebaseStatus.hasConflicts) {
        // We're in a rebase and all conflicts are resolved, navigate back to rebase view
        message.success("All conflicts resolved! Returning to rebase panel...");
        setActiveView("rebase");
      }
    } catch (error) {
      console.error("Error checking rebase status:", error);
    }
  };

  const bumpGraphRefresh = () => {
    setGraphRefreshToken((prev) => prev + 1);
  };

  const handleHistoryChanged = async () => {
    if (!selectedRepo) return;

    // Ensure graph view reloads even if repoPath/branch selection didn't change.
    bumpGraphRefresh();

    // Keep commits list fresh for when user switches back.
    try {
      const commitsData = await window.electronAPI.getCommits(
        selectedRepo,
        undefined,
        0,
        25,
      );
      setCommits(commitsData);
      setHasMoreCommits(commitsData.length === 25);
    } catch (error) {
      console.error("Error refreshing commits after history change:", error);
    }
  };

  const handleStashSelect = (stash: StashEntry) => {
    setSelectedStash(stash);
  };

  const handleBlameCommitClick = async (commitHash: string) => {
    if (!selectedRepo) return;

    // Try to find commit in current commits list
    const existingCommit = commits.find((c) => c.hash.startsWith(commitHash));

    if (existingCommit) {
      await openCommitDetails(existingCommit, {
        targetActiveView: "commits",
        clearDetailPanels: true,
      });
    } else {
      try {
        const commitInfo: CommitInfo = {
          hash: commitHash,
          date: "",
          message: "",
          author: "",
          refs: "",
        };

        await openCommitDetails(commitInfo, {
          targetActiveView: "commits",
          clearDetailPanels: true,
        });
        message.success(`Navigated to commit ${commitHash.substring(0, 7)}`);
      } catch (error) {
        console.error("Error loading commit from blame:", error);
        message.error("Failed to load commit details");
      }
    }
  };

  const renderMainPanel = () => {
    const backLabels = getBackLabels();

    // Show remote management panel when remotes view is active
    if (activeView === "remotes" && selectedRepo) {
      return (
        <div style={{ height: "100%", overflow: "auto" }}>
          <RemoteManagementPanel
            repoPath={selectedRepo}
            onRefresh={handleRefresh}
          />
        </div>
      );
    }

    // Show tags management panel when tags view is active
    if (activeView === "tags" && selectedRepo) {
      return (
        <div style={{ height: "100%", overflow: "auto" }}>
          <TagsPanel repoPath={selectedRepo} onRefresh={handleRefresh} />
        </div>
      );
    }

    // Show interactive rebase panel when rebase view is active
    if (activeView === "rebase" && selectedRepo) {
      return (
        <div style={{ height: "100%", overflow: "auto" }}>
          <InteractiveRebasePanel
            repoPath={selectedRepo}
            branches={branches}
            currentBranch={currentBranch}
            onRefresh={handleRefresh}
            onSwitchToConflicts={(filePath) => {
              setActiveView("conflicts");
              handleConflictFileClick(filePath);
            }}
          />
        </div>
      );
    }

    // Show file editor when viewing file from explorer
    if (mainPanelView === "editor" && selectedExplorerFile && selectedRepo) {
      return (
        <div
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <FileEditorPanel
            repoPath={selectedRepo}
            filePath={selectedExplorerFile}
            backLabel={backLabels.editor}
            onBack={() =>
              goBackInNavigation(() => {
                setSelectedExplorerFile(null);
                setMainPanelView("graph");
              })
            }
            onCommitClick={handleBlameCommitClick}
            onFileHistoryClick={handleFileHistoryClick}
          />
        </div>
      );
    }

    // Show file history when selected
    if (
      mainPanelView === "fileHistory" &&
      selectedHistoryFile &&
      selectedRepo
    ) {
      return (
        <div
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <FileHistoryPanel
            repoPath={selectedRepo}
            filePath={selectedHistoryFile}
            backLabel={backLabels.fileHistory}
            onBack={handleBackFromFileHistory}
            onCommitClick={handleBlameCommitClick}
          />
        </div>
      );
    }

    // Show file diff if requested (for commits)
    if (mainPanelView === "diff" && fileDiff) {
      return (
        <div
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <FileDiffPanel
            diff={fileDiff}
            backLabel={backLabels.diff}
            onBack={() =>
              goBackInNavigation(() => {
                setSelectedFile(null);
                setFileDiff(null);
                setMainPanelView("graph");
              })
            }
            repoPath={selectedRepo}
            filePath={fileDiff.path}
            onRefresh={handleConflictsRefresh}
            onAllConflictsResolved={handleAllConflictsResolved}
          />
        </div>
      );
    }

    // Show reflog in main panel when reflog view is active
    if (activeView === "reflog" && selectedRepo) {
      return (
        <div
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <ReflogPanel
            repoPath={selectedRepo}
            onEntryClick={handleReflogEntryClick}
          />
        </div>
      );
    }

    // Show stash details when stash is selected and view is active
    if (activeView === "stash" && selectedRepo) {
      return (
        <div
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <StashDetailsPanel
            repoPath={selectedRepo}
            selectedStash={selectedStash}
          />
        </div>
      );
    }

    // Show git graph for normal view (when not showing diff)
    if (selectedRepo && branches.length > 0 && mainPanelView !== "diff") {
      return (
        <GitGraphView
          repoPath={selectedRepo}
          branches={branches}
          onCommitClick={handleGraphCommitClick}
          refreshToken={graphRefreshToken}
        />
      );
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
        onToggleTheme={toggleTheme}
        loadingProgress={loadingProgress}
        onBranchSwitch={handleBranchSwitch}
        onStashAndSwitch={handleStashAndSwitch}
        onDiscardAndSwitch={handleDiscardAndSwitch}
      />

      {!selectedRepo ? (
        <div className="main-content">
          <div className="empty-state">
            <FolderOpenOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <h2>No Repository Selected</h2>
            <p>Open a folder to scan for Git repositories</p>
            {scanningRepos && loadingProgress.total > 0 && (
              <div style={{ width: "300px", marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "14px",
                    marginBottom: "8px",
                    color: isDarkMode ? "#d4d4d4" : "#333",
                  }}
                >
                  Loading repositories: {loadingProgress.current} /{" "}
                  {loadingProgress.total}(
                  {Math.round(
                    (loadingProgress.current / loadingProgress.total) * 100,
                  )}
                  %)
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: isDarkMode ? "#333" : "#e0e0e0",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                      height: "100%",
                      backgroundColor: "#1890ff",
                      transition: "width 0.3s ease",
                    }}
                  />
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
            onHistoryChanged={handleHistoryChanged}
            onChangedFileClick={handleChangedFileClick}
            onPushRepo={handlePushRepository}
            pushing={repoOps[selectedRepo] === "push"}
            onFileExplorerFileClick={handleFileExplorerFileClick}
            branches={branches}
            currentBranch={currentBranch}
            onCheckoutBranch={handleCheckoutBranch}
            onMergeBranch={handleMergeBranch}
            onBranchesRefresh={handleBranchesRefresh}
            commitFiles={commitFiles}
            selectedCommitHash={selectedCommit?.hash}
            onFileClick={handleFileClick}
            selectedFile={selectedFile}
            loadingFile={loadingFileDiff}
            onReflogEntryClick={handleReflogEntryClick}
            onStashRefresh={handleChangesRefresh}
            onStashSelect={handleStashSelect}
            selectedStashIndex={selectedStash?.index ?? null}
            onConflictFileClick={handleConflictFileClick}
            onConflictsRefresh={handleConflictsRefresh}
            onAllConflictsResolved={handleAllConflictsResolved}
            conflictRefreshToken={conflictRefreshToken}
            loadingBranches={loadingBranches}
            loadingReflog={loadingReflog}
            loadingStash={loadingStash}
            loadingConflicts={loadingConflicts}
            showingCommitFiles={showingCommitFiles}
            onBackToCommits={handleBackToCommits}
            onBackToCommitsLabel={getBackLabels().commitFiles}
            width={middlePanelWidth}
            onResize={handleMiddlePanelResize}
          />

          <div className="main-panel">{renderMainPanel()}</div>
        </>
      )}
    </div>
  );
};

export default App;
