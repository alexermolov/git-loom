import React from 'react';
import { Button, Empty } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import CommitsPanel from './CommitsPanel';
import ChangesPanel from './ChangesPanel';
import BranchTreePanel from './BranchTreePanel';
import CommitFilesPanel from './CommitFilesPanel';
import FileTreePanel from './FileTreePanel';
import ReflogPanel from './ReflogPanel';
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
  
  // Sub-view state
  showingCommitFiles?: boolean;
  onBackToCommits?: () => void;
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
  selectedCommitHash = '',
  onFileClick,
  onBackToBranches,
  showingCommitFiles = false,
  onBackToCommits,
}) => {
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
              repoPath={repoPath}ExplorerFile
              onFileClick={onFileClick}
            />
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

  return <div className="middle-panel">{renderContent()}</div>;
};

export default MiddlePanel;
