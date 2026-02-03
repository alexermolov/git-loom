import React from "react";
import { Button, Empty } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import CommitsPanel from "./CommitsPanel";
import ChangesPanel from "./ChangesPanel";
import BranchTreePanel from "./BranchTreePanel";
import CommitFilesPanel from "./CommitFilesPanel";
import FileTreePanel from "./FileTreePanel";
import ReflogPanel from "./ReflogPanel";
import StashListPanel from "./StashListPanel";
import ConflictResolutionPanel from "./ConflictResolutionPanel";
import SearchCommitsPanel from "./SearchCommitsPanel";
import {
  CommitInfo,
  BranchInfo,
  CommitFile,
  FileStatus,
  ReflogEntry,
  StashEntry,
  SearchResult,
} from "../types";
import { ViewType } from "./IconSidebar";

interface MiddlePanelProps {
  view: ViewType;
  repoPath: string;

  // Commits view
  commits?: CommitInfo[];
  onCommitClick?: (commit: CommitInfo) => void;
  onLoadMoreCommits?: () => Promise<void>;
  hasMoreCommits?: boolean;

  // Changes view
  onChangesRefresh?: () => void;
  onChangedFileClick?: (file: FileStatus) => void;

  // File Explorer view
  onFileExplorerFileClick?: (filePath: string) => void;

  // Branches view
  branches?: BranchInfo[];
  currentBranch?: string;
  onCheckoutBranch?: (branchName: string) => void;
  onMergeBranch?: (branchName: string) => void;
  onBranchesRefresh?: () => void;

  // Commit files view
  commitFiles?: CommitFile[];
  selectedCommitHash?: string;
  onFileClick?: (file: CommitFile) => void;
  onBackToBranches?: () => void;
  selectedFile?: CommitFile | null;
  loadingFile?: boolean;

  // Reflog view
  onReflogEntryClick?: (entry: ReflogEntry) => void;

  // Stash view
  onStashRefresh?: () => void;
  onStashSelect?: (stash: StashEntry) => void;
  selectedStashIndex?: number | null;

  // Theme
  isDarkTheme?: boolean;

  // Conflicts view
  onConflictFileClick?: (filePath: string) => void;
  onConflictsRefresh?: () => void;

  // Loading states
  loadingBranches?: boolean;
  loadingReflog?: boolean;
  loadingStash?: boolean;
  loadingConflicts?: boolean;

  // Sub-view state
  showingCommitFiles?: boolean;
  onBackToCommits?: () => void;

  // Panel resize
  width?: number;
  onResize?: (width: number) => void;

  // Search view
  repositories?: Map<string, any>;
  onSearchCommitClick?: (commit: SearchResult) => void;
  onSearchFileClick?: (file: CommitFile) => void;
  selectedSearchCommit?: SearchResult | null;
  searchCommitFiles?: CommitFile[];
}

const MiddlePanel: React.FC<MiddlePanelProps> = ({
  view,
  repoPath,
  commits = [],
  onCommitClick,
  onLoadMoreCommits,
  hasMoreCommits = false,
  onChangesRefresh,
  onChangedFileClick,
  onFileExplorerFileClick,
  branches = [],
  currentBranch = "",
  onCheckoutBranch,
  onMergeBranch,
  onBranchesRefresh,
  commitFiles = [],
  onReflogEntryClick,
  onStashRefresh,
  onStashSelect,
  selectedStashIndex,
  selectedCommitHash = "",
  onFileClick,
  onBackToBranches,
  selectedFile,
  loadingFile,
  showingCommitFiles = false,
  onBackToCommits,
  onConflictFileClick,
  onConflictsRefresh,
  loadingBranches = false,
  loadingReflog = false,
  loadingStash = false,
  loadingConflicts = false,
  isDarkTheme = false,
  width = 350,
  onResize,
  repositories,
  onSearchCommitClick,
  onSearchFileClick,
  selectedSearchCommit,
  searchCommitFiles = [],
}) => {
  const resizeRef = React.useRef<HTMLDivElement>(null);
  const isResizingRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !onResize) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + deltaX;
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };
  const renderContent = () => {
    // If showing commit files, override the view
    if (showingCommitFiles && commitFiles.length > 0) {
      return (
        <div className="middle-panel-content">
          <div className="middle-panel-header">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBackToCommits}
              size="small"
            >
              Back to Commits
            </Button>
            <div className="middle-panel-title">Commit Files</div>
          </div>
          <CommitFilesPanel
            files={commitFiles}
            commitHash={selectedCommitHash}
            onFileClick={onFileClick}
            onBack={onBackToCommits}
            selectedFile={selectedFile}
            loadingFile={loadingFile}
          />
        </div>
      );
    }

    switch (view) {
      case "changes":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Source Control</div>
            </div>
            <ChangesPanel
              repoPath={repoPath}
              onRefresh={onChangesRefresh}
              onFileClick={onChangedFileClick}
            />
          </div>
        );

      case "commits":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Commits History</div>
            </div>
            <CommitsPanel
              commits={commits}
              onCommitClick={onCommitClick}
              onLoadMore={onLoadMoreCommits}
              hasMore={hasMoreCommits}
            />
          </div>
        );

      case "branches":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Branches</div>
            </div>
            <BranchTreePanel
              repoPath={repoPath}
              branches={branches}
              currentBranch={currentBranch}
              onCheckoutBranch={onCheckoutBranch}
              onRefresh={onBranchesRefresh}
              onMergeBranch={onMergeBranch}
              loading={loadingBranches}
            />
          </div>
        );

      case "fileTree":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">File Explorer</div>
            </div>
            <FileTreePanel
              repoPath={repoPath}
              onFileClick={onFileExplorerFileClick}
            />
          </div>
        );

      case "stash":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Stashes</div>
            </div>
            <StashListPanel
              repoPath={repoPath}
              onRefresh={onStashRefresh}
              onStashSelect={onStashSelect}
              selectedStashIndex={selectedStashIndex}
              loading={loadingStash}
            />
          </div>
        );

      case "reflog":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Git Reflog Documentation</div>
            </div>
            <div
              className="middle-panel-info"
              style={{ padding: "20px", maxWidth: "800px" }}
            >
              <h3 style={{ marginTop: 0, color: "var(--primary-color)" }}>
                What is Git Reflog?
              </h3>
              <p>
                <strong>Reflog</strong> (reference log) is Git's safety net that
                records every movement of HEAD and branch tips. It tracks all
                changes including commits, checkouts, merges, resets, and
                rebases.
              </p>

              <h3 style={{ color: "var(--primary-color)" }}>Key Features</h3>
              <ul style={{ lineHeight: "1.8" }}>
                <li>
                  <strong>Safety Net:</strong> Recover "lost" commits, undo
                  mistakes, and restore deleted branches
                </li>
                <li>
                  <strong>Local History:</strong> View all repository state
                  changes in chronological order
                </li>
                <li>
                  <strong>Time Travel:</strong> Jump to any previous state using{" "}
                  <code>HEAD@{"{n}"}</code> syntax
                </li>
                <li>
                  <strong>Audit Trail:</strong> Track who made changes and when
                </li>
              </ul>

              <h3 style={{ color: "var(--primary-color)" }}>
                Common Use Cases
              </h3>
              <div style={{ marginBottom: "12px" }}>
                <strong>🔄 Undo a Hard Reset:</strong>
                <p
                  style={{ marginLeft: "20px", color: "var(--text-secondary)" }}
                >
                  Accidentally ran <code>git reset --hard</code>? Find the
                  commit before reset in reflog and restore it.
                </p>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <strong>🌿 Restore Deleted Branch:</strong>
                <p
                  style={{ marginLeft: "20px", color: "var(--text-secondary)" }}
                >
                  Deleted a branch by mistake? Reflog shows the last commit on
                  that branch.
                </p>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <strong>⏮️ Undo Rebase/Amend:</strong>
                <p
                  style={{ marginLeft: "20px", color: "var(--text-secondary)" }}
                >
                  Rebase went wrong? Find the state before rebase started and
                  reset to it.
                </p>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <strong>🔍 Debug History:</strong>
                <p
                  style={{ marginLeft: "20px", color: "var(--text-secondary)" }}
                >
                  Understand what operations were performed on the repository
                  over time.
                </p>
              </div>

              <h3 style={{ color: "var(--primary-color)" }}>
                Reference Syntax
              </h3>
              <ul
                style={{
                  lineHeight: "1.8",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}
              >
                <li>
                  <code>HEAD@{"{0}"}</code> - Current HEAD position (most
                  recent)
                </li>
                <li>
                  <code>HEAD@{"{1}"}</code> - Previous HEAD position
                </li>
                <li>
                  <code>HEAD@{"{2.hours.ago}"}</code> - HEAD position 2 hours
                  ago
                </li>
                <li>
                  <code>master@{"{yesterday}"}</code> - Master branch position
                  yesterday
                </li>
              </ul>

              <h3 style={{ color: "var(--primary-color)" }}>Important Notes</h3>
              <div
                style={{
                  background: "var(--warning-bg)",
                  border: "1px solid var(--warning-border)",
                  borderRadius: "4px",
                  padding: "12px",
                  marginTop: "12px",
                  color: "var(--warning-text)",
                }}
              >
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>
                    Reflog is <strong>local only</strong> - not shared with
                    other clones
                  </li>
                  <li>
                    Entries expire after <strong>90 days</strong> by default
                    (configurable)
                  </li>
                  <li>
                    Unreachable commits are garbage collected after expiration
                  </li>
                  <li>Each clone has its own independent reflog</li>
                </ul>
              </div>

              <h3 style={{ color: "var(--primary-color)", marginTop: "20px" }}>
                Actions Available
              </h3>
              <p>Use the dropdown menu (⋮) on each reflog entry to:</p>
              <ul style={{ lineHeight: "1.8" }}>
                <li>
                  <strong>View Details:</strong> See commit content and changes
                </li>
                <li>
                  <strong>Cherry-pick:</strong> Apply this commit to current
                  branch
                </li>
                <li>
                  <strong>Reset (Soft):</strong> Move HEAD but keep changes
                  staged
                </li>
                <li>
                  <strong>Reset (Mixed):</strong> Move HEAD and unstage changes
                </li>
                <li>
                  <strong>Reset (Hard):</strong> Move HEAD and discard all
                  changes
                </li>
                <li>
                  <strong>Copy Hash:</strong> Copy commit SHA to clipboard
                </li>
              </ul>
            </div>
          </div>
        );

      case "conflicts":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Merge Conflicts</div>
            </div>
            <ConflictResolutionPanel
              repoPath={repoPath}
              onFileClick={onConflictFileClick}
              onRefresh={onConflictsRefresh}
              loading={loadingConflicts}
            />
          </div>
        );

      case "graph":
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Git Graph</div>
            </div>
            <div className="middle-panel-info">
              <Empty description="Graph view is shown in the main panel" />
            </div>
          </div>
        );

      case "search":
        return (
          <div className="middle-panel-content" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SearchCommitsPanel
              selectedRepo={repoPath}
              repositories={repositories || new Map()}
              onCommitClick={onSearchCommitClick || (() => {})}
              onFileClick={onSearchFileClick || (() => {})}
              selectedCommit={selectedSearchCommit}
              commitFiles={searchCommitFiles}
              selectedFile={selectedFile}
              loadingFile={loadingFile}
            />
          </div>
        );

      default:
        return (
          <div className="middle-panel-content">
            <Empty description="Select a view from the sidebar" />
          </div>
        );
    }
  };

  return (
    <div
      ref={resizeRef}
      className="middle-panel"
      style={{ width: `${width}px` }}
    >
      {renderContent()}
      <div
        className="middle-panel-resize-handle"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
};

export default MiddlePanel;
