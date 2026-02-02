import React from 'react';
import { Button, Empty } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import CommitsPanel from './CommitsPanel';
import ChangesPanel from './ChangesPanel';
import BranchTreePanel from './BranchTreePanel';
import CommitFilesPanel from './CommitFilesPanel';
import FileTreePanel from './FileTreePanel';
import ReflogPanel from './ReflogPanel';
import StashPanel from './StashPanel';
import { CommitInfo, BranchInfo, CommitFile, FileStatus, ReflogEntry } from '../types';
import { ViewType } from './IconSidebar';

interface MiddlePanelProps {
  view: ViewType;
  repoPath: string;
  
  // Commits view
  commits?: CommitInfo[];
  onCommitClick?: (commit: CommitInfo) => void;
  
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
  
  // Commit files view
  commitFiles?: CommitFile[];
  selectedCommitHash?: string;
  onFileClick?: (file: CommitFile) => void;
  onBackToBranches?: () => void;
  
  // Reflog view
  onReflogEntryClick?: (entry: ReflogEntry) => void;
  
  // Stash view
  onStashRefresh?: () => void;
  
  // Sub-view state
  showingCommitFiles?: boolean;
  onBackToCommits?: () => void;
  
  // Panel resize
  width?: number;
  onResize?: (width: number) => void;
}

const MiddlePanel: React.FC<MiddlePanelProps> = ({
  view,
  repoPath,
  commits = [],
  onCommitClick,
  onChangesRefresh,
  onChangedFileClick,
  onFileExplorerFileClick,
  branches = [],
  currentBranch = '',
  onCheckoutBranch,
  onMergeBranch,
  commitFiles = [],
  onReflogEntryClick,
  onStashRefresh,
  selectedCommitHash = '',
  onFileClick,
  onBackToBranches,
  showingCommitFiles = false,
  onBackToCommits,
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
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
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
          />
        </div>
      );
    }

    switch (view) {
      case 'changes':
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

      case 'commits':
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Commits History</div>
            </div>
            <CommitsPanel
              commits={commits}
              onCommitClick={onCommitClick}
            />
          </div>
        );

      case 'branches':
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
              onMergeBranch={onMergeBranch}
            />
          </div>
        );

      case 'fileTree':
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

      case 'stash':
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Stashes</div>
            </div>
            <div className="middle-panel-info">
              <Empty description="Stash view is shown in the main panel" />
            </div>
          </div>
        );

      case 'reflog':
        return (
          <div className="middle-panel-content">
            <div className="middle-panel-header">
              <div className="middle-panel-title">Reflog</div>
            </div>
            <div className="middle-panel-info">
              <Empty description="Reflog view is shown in the main panel" />
            </div>
          </div>
        );

      case 'graph':
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
