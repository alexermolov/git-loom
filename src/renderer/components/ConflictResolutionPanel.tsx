import React, { useState, useEffect } from 'react';
import { List, Button, Tag, Space, Modal, message, Divider, Tooltip, Spin, App } from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ConflictFile } from '../types';

interface ConflictResolutionPanelProps {
  repoPath: string | null;
  onFileClick?: (filePath: string) => void;
  onRefresh?: () => void;
  onAllConflictsResolved?: () => void;
  loading?: boolean;
}

const ConflictResolutionPanel: React.FC<ConflictResolutionPanelProps> = ({
  repoPath,
  onFileClick,
  onRefresh,
  onAllConflictsResolved,
  loading: externalLoading = false,
}) => {
  const { modal } = App.useApp();
  const [conflictedFiles, setConflictedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (repoPath) {
      loadConflictedFiles();
    }
  }, [repoPath]);

  const loadConflictedFiles = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const files = await window.electronAPI.getConflictedFiles(repoPath);
      setConflictedFiles(files);
    } catch (error) {
      console.error('Error loading conflicted files:', error);
      message.error('Failed to load conflicted files');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAll = async (filePath: string, resolution: 'ours' | 'theirs' | 'both') => {
    if (!repoPath) return;

    setResolving({ ...resolving, [filePath]: true });
    try {
      await window.electronAPI.resolveConflict(repoPath, filePath, resolution);
      message.success(`Resolved all conflicts in ${filePath} using "${resolution}"`);
      await loadConflictedFiles();
      if (onRefresh) onRefresh();
      
      // Check if all conflicts are resolved and trigger callback
      const remainingConflicts = await window.electronAPI.getConflictedFiles(repoPath);
      if (remainingConflicts.length === 0 && onAllConflictsResolved) {
        onAllConflictsResolved();
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      message.error(`Failed to resolve conflicts: ${error}`);
    } finally {
      setResolving({ ...resolving, [filePath]: false });
    }
  };

  const handleLaunchMergeTool = async (filePath: string) => {
    if (!repoPath) return;

    try {
      await window.electronAPI.launchMergeTool(repoPath, filePath);
      message.success(`Launched merge tool for ${filePath}`);
      // Refresh after a delay to give user time to use merge tool
      setTimeout(async () => {
        await loadConflictedFiles();
        if (onRefresh) onRefresh();
        
        // Check if all conflicts are resolved and trigger callback
        const remainingConflicts = await window.electronAPI.getConflictedFiles(repoPath);
        if (remainingConflicts.length === 0 && onAllConflictsResolved) {
          onAllConflictsResolved();
        }
      }, 2000);
    } catch (error) {
      console.error('Error launching merge tool:', error);
      message.error(`Failed to launch merge tool: ${error}`);
    }
  };

  const handleAbortMerge = () => {
    if (!repoPath) return;

    modal.confirm({
      title: 'Abort Merge',
      content: 'Are you sure you want to abort the merge? All conflict resolution progress will be lost.',
      okText: 'Abort Merge',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await window.electronAPI.abortMerge(repoPath);
          message.success('Merge aborted successfully');
          await loadConflictedFiles();
          if (onRefresh) onRefresh();
        } catch (error) {
          console.error('Error aborting merge:', error);
          message.error(`Failed to abort merge: ${error}`);
        }
      },
    });
  };

  const handleContinueMerge = async () => {
    if (!repoPath) return;

    if (conflictedFiles.length > 0) {
      message.warning('Cannot continue merge: there are still unresolved conflicts');
      return;
    }

    try {
      await window.electronAPI.continueMerge(repoPath);
      message.success('Merge completed successfully');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error continuing merge:', error);
      message.error(`Failed to continue merge: ${error}`);
    }
  };

  if (!repoPath) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
        <div style={{ color: 'var(--text-secondary)' }}>
          No repository selected
        </div>
      </div>
    );
  }

  if (loading || externalLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px' 
      }}>
        <Spin size="large" tip="Loading conflicts..." />
      </div>
    );
  }

  if (conflictedFiles.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            No Conflicts
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            All files are conflict-free
          </div>
        </div>
        <Button 
          type="primary" 
          block 
          onClick={loadConflictedFiles}
          loading={loading}
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="conflict-resolution-panel">
      <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WarningOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Merge Conflicts
            </span>
            <Tag color="warning">{conflictedFiles.length}</Tag>
          </div>
          <Tooltip title="Refresh conflicts list">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={loadConflictedFiles}
              size="small"
            />
          </Tooltip>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Resolve conflicts by choosing a resolution strategy or editing files manually.
        </div>

        <Space style={{ width: '100%' }} direction="vertical">
          <Button
            type="primary"
            block
            icon={<CheckCircleOutlined />}
            onClick={handleContinueMerge}
            disabled={conflictedFiles.length > 0}
          >
            Complete Merge
          </Button>
          <Button
            danger
            block
            icon={<CloseCircleOutlined />}
            onClick={handleAbortMerge}
          >
            Abort Merge
          </Button>
        </Space>
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <List
          loading={loading}
          dataSource={conflictedFiles}
          renderItem={(filePath) => (
            <List.Item
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-light)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              }}
            >
              <div style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                  onClick={() => onFileClick?.(filePath)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <FileTextOutlined style={{ color: '#faad14' }} />
                    <span
                      style={{
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: 13,
                      }}
                    >
                      {filePath}
                    </span>
                  </div>
                  <Tag color="warning">CONFLICT</Tag>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Quick Actions:
                </div>

                <Space size="small" wrap>
                  <Tooltip title="Keep your changes (HEAD)">
                    <Button
                      size="small"
                      type="default"
                      loading={resolving[filePath]}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolveAll(filePath, 'ours');
                      }}
                    >
                      Accept Ours
                    </Button>
                  </Tooltip>
                  <Tooltip title="Keep their changes (incoming)">
                    <Button
                      size="small"
                      type="default"
                      loading={resolving[filePath]}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolveAll(filePath, 'theirs');
                      }}
                    >
                      Accept Theirs
                    </Button>
                  </Tooltip>
                  <Tooltip title="Keep both changes">
                    <Button
                      size="small"
                      type="default"
                      loading={resolving[filePath]}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolveAll(filePath, 'both');
                      }}
                    >
                      Accept Both
                    </Button>
                  </Tooltip>
                  <Tooltip title="Open external merge tool">
                    <Button
                      size="small"
                      icon={<ToolOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunchMergeTool(filePath);
                      }}
                    >
                      Merge Tool
                    </Button>
                  </Tooltip>
                  <Tooltip title="View and edit conflicts manually">
                    <Button
                      size="small"
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileClick?.(filePath);
                      }}
                    >
                      Resolve Manually
                    </Button>
                  </Tooltip>
                </Space>
              </div>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};

export default ConflictResolutionPanel;
