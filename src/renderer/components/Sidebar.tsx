import React, { useState } from 'react';
import { Button, Spin, Badge, Tooltip, Input, Tag } from 'antd';
import { FolderOpenOutlined, BranchesOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, SearchOutlined, FileTextOutlined, PlusOutlined, MinusOutlined, EditOutlined, MenuFoldOutlined, MenuUnfoldOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons';
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
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
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
  isDarkTheme = false,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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
    <div className="sidebar" style={{ width: collapsed ? '48px' : '300px', transition: 'width 0.3s' }}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Tooltip title={collapsed ? 'Expand panel' : 'Collapse panel'}>
            <Button
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              size="small"
            />
          </Tooltip>
          {!collapsed && onToggleTheme && (
            <Tooltip title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}>
              <Button
                icon={isDarkTheme ? <BulbFilled /> : <BulbOutlined />}
                onClick={onToggleTheme}
                size="small"
                style={{ color: isDarkTheme ? '#ffd700' : '#666' }}
              />
            </Tooltip>
          )}
        </div>
        {!collapsed && (
          <>
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
          </>
        )}
      </div>

      {!collapsed && (
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
              </div>
              
              {/* File status indicators */}
              {(repo.status.modified.length > 0 || repo.status.created.length > 0 || repo.status.deleted.length > 0) && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                  {repo.status.modified.length > 0 && (
                    <Tooltip title={`${repo.status.modified.length} modified file${repo.status.modified.length > 1 ? 's' : ''}`}>
                      <Tag color="orange" style={{ fontSize: 11, margin: 0, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <EditOutlined style={{ fontSize: 10 }} />
                        M: {repo.status.modified.length}
                      </Tag>
                    </Tooltip>
                  )}
                  {repo.status.created.length > 0 && (
                    <Tooltip title={`${repo.status.created.length} added file${repo.status.created.length > 1 ? 's' : ''}`}>
                      <Tag color="green" style={{ fontSize: 11, margin: 0, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <PlusOutlined style={{ fontSize: 10 }} />
                        A: {repo.status.created.length}
                      </Tag>
                    </Tooltip>
                  )}
                  {repo.status.deleted.length > 0 && (
                    <Tooltip title={`${repo.status.deleted.length} deleted file${repo.status.deleted.length > 1 ? 's' : ''}`}>
                      <Tag color="red" style={{ fontSize: 11, margin: 0, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MinusOutlined style={{ fontSize: 10 }} />
                        D: {repo.status.deleted.length}
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
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
      )}
    </div>
  );
};

export default Sidebar;
