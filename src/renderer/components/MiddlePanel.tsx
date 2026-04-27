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
import {
  CommitInfo,
  BranchInfo,
  CommitFile,
  FileStatus,
  ReflogEntry,
  StashEntry,
} from "../types";
import { ViewType } from "./IconSidebar";

type DocumentationSection = {
  title: string;
  content: React.ReactNode;
};

const renderDocumentationView = (
  title: string,
  subtitle: React.ReactNode,
  sections: DocumentationSection[],
  note?: React.ReactNode,
) => (
  <div className="middle-panel-content">
    <div className="middle-panel-header">
      <div className="middle-panel-title">{title}</div>
    </div>
    <div
      className="middle-panel-info"
      style={{ padding: "20px", maxWidth: "800px" }}
    >
      <p style={{ marginTop: 0, color: "var(--text-secondary)" }}>
        {subtitle}
      </p>

      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: "20px" }}>
          <h3 style={{ color: "var(--primary-color)", marginBottom: "8px" }}>
            {section.title}
          </h3>
          <div style={{ lineHeight: "1.8" }}>{section.content}</div>
        </div>
      ))}

      {note ? (
        <div
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            borderRadius: "4px",
            padding: "12px",
            color: "var(--warning-text)",
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  </div>
);

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
  onHistoryChanged?: () => void;
  onChangedFileClick?: (file: FileStatus) => void;
  onPushRepo?: (repoPath: string) => void;
  pushing?: boolean;

  // File Explorer view
  onFileExplorerFileClick?: (filePath: string) => void;

  // Branches view
  branches?: BranchInfo[];
  currentBranch?: string;
  onCheckoutBranch?: (branchName: string) => void;
  onMergeBranch?: (
    branchName: string,
    mergeMode?: "auto" | "no-ff" | "ff-only",
  ) => void;
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

  // Conflicts view
  onConflictFileClick?: (filePath: string) => void;
  onConflictsRefresh?: () => void;
  onAllConflictsResolved?: () => void;
  conflictRefreshToken?: number;

  // Loading states
  loadingBranches?: boolean;
  loadingReflog?: boolean;
  loadingStash?: boolean;
  loadingConflicts?: boolean;

  // Sub-view state
  showingCommitFiles?: boolean;
  onBackToCommits?: () => void;
  onBackToCommitsLabel?: string;

  // Panel resize
  width?: number;
  onResize?: (width: number) => void;

}

const MiddlePanel: React.FC<MiddlePanelProps> = ({
  view,
  repoPath,
  commits = [],
  onCommitClick,
  onLoadMoreCommits,
  hasMoreCommits = false,
  onChangesRefresh,
  onHistoryChanged,
  onChangedFileClick,
  onPushRepo,
  pushing = false,
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
  onBackToCommitsLabel = "Back to Commits",
  onConflictFileClick,
  onConflictsRefresh,
  onAllConflictsResolved,
  conflictRefreshToken,
  loadingBranches = false,
  loadingReflog = false,
  loadingStash = false,
  loadingConflicts = false,
  width = 350,
  onResize,
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
              {onBackToCommitsLabel}
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
              onHistoryChanged={onHistoryChanged}
              onFileClick={onChangedFileClick}
              onPushRepo={onPushRepo}
              pushing={pushing}
              isActive={view === "changes"}
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
              repoPath={repoPath}
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

      case "tags":
        return renderDocumentationView(
          "Git Tags Documentation",
          <>
            Tags mark important points in history, usually releases, milestones,
            or externally referenced builds. The full tag management UI is
            shown in the main panel.
          </>,
          [
            {
              title: "What Tags Are For",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Mark releases such as v1.0.0 or v2.3.1</li>
                  <li>Keep a stable reference for deployments or QA builds</li>
                  <li>Annotate important historical points in the repository</li>
                </ul>
              ),
            },
            {
              title: "Tag Types",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>
                    <strong>Lightweight tag:</strong> a simple named pointer to
                    a commit
                  </li>
                  <li>
                    <strong>Annotated tag:</strong> stores tagger, date, and a
                    message, which is better for releases
                  </li>
                </ul>
              ),
            },
            {
              title: "Actions In This Tab",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Create a tag on HEAD or a specific commit hash</li>
                  <li>Inspect tag details and linked commit metadata</li>
                  <li>Checkout a tag to inspect code in detached HEAD mode</li>
                  <li>Push one tag or all tags to a remote</li>
                  <li>Delete tags locally or from a remote</li>
                </ul>
              ),
            },
          ],
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>Tags are not pushed automatically with normal branch pushes</li>
            <li>
              Checking out a tag places Git into detached HEAD until you create
              or switch to a branch
            </li>
            <li>Prefer annotated tags for public releases</li>
          </ul>,
        );

      case "remotes":
        return renderDocumentationView(
          "Git Remotes Documentation",
          <>
            Remotes connect this local repository to shared servers such as
            GitHub, GitLab, or another bare repository. Remote management is
            available in the main panel.
          </>,
          [
            {
              title: "What A Remote Does",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Defines where you fetch branches and tags from</li>
                  <li>Defines where you push local work to</li>
                  <li>Can use separate fetch and push URLs for the same name</li>
                </ul>
              ),
            },
            {
              title: "Actions In This Tab",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Add, rename, edit, or remove remotes</li>
                  <li>Fetch from a remote, optionally with prune</li>
                  <li>Prune stale remote-tracking branches</li>
                  <li>Review fetch and push URLs</li>
                  <li>Set or change upstream tracking for the current branch</li>
                </ul>
              ),
            },
            {
              title: "Why Upstream Matters",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>
                    Upstream links a local branch to a remote branch such as
                    <code> origin/main</code>
                  </li>
                  <li>
                    It enables simpler pull and push workflows without entering
                    the full remote/branch pair every time
                  </li>
                  <li>
                    It also powers ahead/behind status in many Git views
                  </li>
                </ul>
              ),
            },
          ],
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>Use prune carefully if you rely on stale remote branch refs</li>
            <li>
              Removing a remote deletes the configuration, not your local
              branches or commits
            </li>
            <li>
              A repository can have multiple remotes, for example origin and
              upstream
            </li>
          </ul>,
        );

      case "rebase":
        return renderDocumentationView(
          "Interactive Rebase Documentation",
          <>
            Interactive rebase rewrites commit history before sharing it,
            letting you clean up messages, combine commits, or reorder work.
            The rebase controls are shown in the main panel.
          </>,
          [
            {
              title: "What Interactive Rebase Is For",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Reorder commits into a clearer story</li>
                  <li>Squash or fixup small commits before opening a PR</li>
                  <li>Rewrite commit messages for clarity</li>
                  <li>Drop commits that should not remain in history</li>
                </ul>
              ),
            },
            {
              title: "Common Rebase Operations",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>
                    <strong>pick:</strong> keep the commit as-is
                  </li>
                  <li>
                    <strong>reword:</strong> keep content, change message
                  </li>
                  <li>
                    <strong>squash/fixup:</strong> combine commits
                  </li>
                  <li>
                    <strong>drop:</strong> remove a commit from history
                  </li>
                </ul>
              ),
            },
            {
              title: "When To Use It",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Before pushing a feature branch for review</li>
                  <li>Before merging, to produce a cleaner linear history</li>
                  <li>
                    When you need to split noisy work into deliberate commits
                  </li>
                </ul>
              ),
            },
          ],
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>Do not rebase shared history unless the team expects it</li>
            <li>
              Rebase can produce conflicts; if that happens, continue from the
              Conflicts tab
            </li>
            <li>
              After rewriting pushed commits, a force push may be required
            </li>
          </ul>,
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
              onAllConflictsResolved={onAllConflictsResolved}
              loading={loadingConflicts}
              refreshToken={conflictRefreshToken}
            />
          </div>
        );

      case "graph":
        return renderDocumentationView(
          "Git Graph Documentation",
          <>
            The commit graph is rendered in the main panel. This view helps you
            read branch structure, merges, tags, and commit flow at a glance.
          </>,
          [
            {
              title: "How To Read It",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Each node is a commit</li>
                  <li>Lines connect parent and child commits</li>
                  <li>Labels identify branches, remotes, HEAD, and tags</li>
                  <li>Merge commits show where histories come together</li>
                </ul>
              ),
            },
            {
              title: "Useful Workflows",
              content: (
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Inspect divergence between branches</li>
                  <li>Verify whether a feature branch was merged</li>
                  <li>Find the commit behind a release tag</li>
                  <li>Open commit details directly from the graph</li>
                </ul>
              ),
            },
          ],
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>
              If branch data looks stale, refresh repository data before relying
              on the graph
            </li>
            <li>
              The graph is most useful together with the commit details and file
              diff views
            </li>
          </ul>,
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
