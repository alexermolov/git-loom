import React, { useState } from 'react';
import { Button, Spin, Badge, Tooltip, Input } from 'antd';
import { FolderOpenOutlined, BranchesOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { RepositoryInfo } from '../types';

interface SidebarProps {
  repositories: RepositoryInfo[];
  selectedRepo: string | null;
  onSelectRepo: (repoPath: string) => void;
  onOpenFolder: () => void;
  onRefresh?: () => void;
  onPullRepo?: (repoPath: string) => void;
  onPushRepo?: (repoPath: string) => void;
  repoOps?: Record<string, 'pull' | 'push' | undefined>;
  scanning: boolean;
  refreshing?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  repositories,
  selectedRepo,
  onSelectRepo,
  onOpenFolder,
  onRefresh,
  onPullRepo,
  onPushRepo,
  repoOps = {},
  scanning,
  refreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter repositories based on search query
  const filteredRepositories = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statPillStyle = (variant: 'outgoing' | 'incoming', active: boolean) => {
    if (active) {
      return variant === 'outgoing'
        ? {
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 6px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: '#52c41a',
          }
        : {
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 6px',
            backgroundColor: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: '#1890ff',
          };
    }

    return {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '2px 6px',
      backgroundColor: '#f0f0f0',
      border: '1px solid #d9d9d9',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      color: '#8c8c8c',
    };
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Button
          type="primary"
          icon={<FolderOpenOutlined />}
          onClick={onOpenFolder}
          loading={scanning}
          block
          style={{ marginBottom: 8 }}
        >
          {scanning ? 'Scanning...' : 'Open Folder'}
        </Button>
        {repositories.length > 0 && (
          <>
            <Tooltip title="Refresh all repositories">
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={onRefresh}
                disabled={scanning || refreshing}
                block
                style={{ marginBottom: 8 }}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Tooltip>
            <Input
              placeholder="Search repositories..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </>
        )}
      </div>

      <div className="sidebar-content">
        {scanning ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Spin tip="Scanning for repositories..." />
          </div>
        ) : repositories.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            <p>No repositories loaded</p>
            <p style={{ fontSize: 12 }}>Click "Open Folder" to scan</p>
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            <p>No repositories found</p>
            <p style={{ fontSize: 12 }}>Try a different search term</p>
          </div>
        ) : (
          filteredRepositories.map((repo) => (
            <div
              key={repo.path}
              className={`repository-item ${selectedRepo === repo.path ? 'active' : ''}`}
              onClick={() => onSelectRepo(repo.path)}
            >
              <div className="repository-name">{repo.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div className="repository-branch">
                  <BranchesOutlined /> {repo.currentBranch}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Tooltip
                    title={
                      repo.outgoingCommits > 0
                        ? `${repo.outgoingCommits} outgoing commit${repo.outgoingCommits > 1 ? 's' : ''} (need push)`
                        : 'No outgoing commits'
                    }
                  >
                    <div style={statPillStyle('outgoing', repo.outgoingCommits > 0)}>
                      <ArrowUpOutlined style={{ fontSize: 10 }} />
                      {repo.outgoingCommits}
                    </div>
                  </Tooltip>
                  {repo.outgoingCommits > 0 && onPushRepo ? (
                    <Tooltip title="Push">
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPushRepo(repo.path);
                        }}
                        loading={repoOps[repo.path] === 'push'}
                        disabled={!!repoOps[repo.path]}
                      >
                        Push
                      </Button>
                    </Tooltip>
                  ) : null}
                  <Tooltip
                    title={
                      repo.incomingCommits > 0
                        ? `${repo.incomingCommits} incoming commit${repo.incomingCommits > 1 ? 's' : ''} (need pull)`
                        : 'No incoming commits'
                    }
                  >
                    <div style={statPillStyle('incoming', repo.incomingCommits > 0)}>
                      <ArrowDownOutlined style={{ fontSize: 10 }} />
                      {repo.incomingCommits}
                    </div>
                  </Tooltip>
                  {repo.incomingCommits > 0 && onPullRepo ? (
                    <Tooltip title="Pull">
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPullRepo(repo.path);
                        }}
                        loading={repoOps[repo.path] === 'pull'}
                        disabled={!!repoOps[repo.path]}
                      >
                        Pull
                      </Button>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
