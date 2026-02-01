import React, { useState, useEffect } from 'react';
import { List, Button, Input, Checkbox, Tag, Space, Divider, message } from 'antd';
import { 
  PlusOutlined, 
  MinusOutlined, 
  FileAddOutlined, 
  FileOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { FileStatus } from '../types';

const { TextArea } = Input;

interface ChangesPanelProps {
  repoPath: string | null;
  onRefresh?: () => void;
  onFileClick?: (file: FileStatus) => void;
}

const ChangesPanel: React.FC<ChangesPanelProps> = ({ repoPath, onRefresh, onFileClick }) => {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (repoPath) {
      loadStatus();
    }
  }, [repoPath]);

  const loadStatus = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const status = await window.electronAPI.getStatus(repoPath);
      setFiles(status);
    } catch (error) {
      console.error('Error loading status:', error);
      message.error('Failed to load file status');
    } finally {
      setLoading(false);
    }
  };

  const handleStageFiles = async (filePaths: string[]) => {
    if (!repoPath) return;

    try {
      await window.electronAPI.stageFiles(repoPath, filePaths);
      message.success(`Staged ${filePaths.length} file(s)`);
      await loadStatus();
      setSelectedFiles(new Set());
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error staging files:', error);
      message.error('Failed to stage files');
    }
  };

  const handleUnstageFiles = async (filePaths: string[]) => {
    if (!repoPath) return;

    try {
      await window.electronAPI.unstageFiles(repoPath, filePaths);
      message.success(`Unstaged ${filePaths.length} file(s)`);
      await loadStatus();
      setSelectedFiles(new Set());
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error unstaging files:', error);
      message.error('Failed to unstage files');
    }
  };

  const handleCommit = async () => {
    if (!repoPath) return;
    if (!commitMessage.trim()) {
      message.warning('Please enter a commit message');
      return;
    }

    const stagedFiles = files.filter(f => f.staged);
    if (stagedFiles.length === 0) {
      message.warning('No files staged for commit');
      return;
    }

    try {
      await window.electronAPI.createCommit(repoPath, commitMessage);
      message.success('Commit created successfully');
      setCommitMessage('');
      await loadStatus();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error creating commit:', error);
      message.error('Failed to create commit');
    }
  };

  const handleSelectFile = (filePath: string, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(filePath);
    } else {
      newSelected.delete(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = (staged: boolean, checked: boolean) => {
    const filesToSelect = files.filter(f => f.staged === staged);
    const newSelected = new Set(selectedFiles);
    
    if (checked) {
      filesToSelect.forEach(f => newSelected.add(f.path));
    } else {
      filesToSelect.forEach(f => newSelected.delete(f.path));
    }
    
    setSelectedFiles(newSelected);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
      case 'untracked':
        return <FileAddOutlined style={{ color: '#52c41a' }} />;
      case 'modified':
        return <EditOutlined style={{ color: '#1890ff' }} />;
      case 'deleted':
        return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
      case 'renamed':
        return <SwapOutlined style={{ color: '#722ed1' }} />;
      default:
        return <FileOutlined />;
    }
  };

  const getStatusTag = (status: string) => {
    const colors: Record<string, string> = {
      added: 'success',
      untracked: 'success',
      modified: 'processing',
      deleted: 'error',
      renamed: 'purple',
    };
    return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
  };

  const unstagedFiles = files.filter(f => !f.staged);
  const stagedFiles = files.filter(f => f.staged);
  const unstagedSelected = unstagedFiles.filter(f => selectedFiles.has(f.path));
  const stagedSelected = stagedFiles.filter(f => selectedFiles.has(f.path));

  return (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3>Changes</h3>
        <Button onClick={loadStatus} loading={loading} style={{ marginRight: '8px' }}>
          Refresh
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
        {/* Staged Files */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px' 
          }}>
            <Space>
              <Checkbox
                checked={stagedFiles.length > 0 && stagedSelected.length === stagedFiles.length}
                indeterminate={stagedSelected.length > 0 && stagedSelected.length < stagedFiles.length}
                onChange={(e) => handleSelectAll(true, e.target.checked)}
              />
              <strong>Staged Changes ({stagedFiles.length})</strong>
            </Space>
            {stagedSelected.length > 0 && (
              <Button
                size="small"
                icon={<MinusOutlined />}
                onClick={() => handleUnstageFiles(stagedSelected.map(f => f.path))}
              >
                Unstage Selected ({stagedSelected.length})
              </Button>
            )}
          </div>
          <List
            size="small"
            bordered
            dataSource={stagedFiles}
            renderItem={(file) => (
              <List.Item
                style={{ padding: '8px 12px', cursor: onFileClick ? 'pointer' : 'default' }}
                onClick={() => onFileClick && onFileClick(file)}
                actions={[
                  <Button
                    size="small"
                    icon={<MinusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnstageFiles([file.path]);
                    }}
                  >
                    Unstage
                  </Button>
                ]}
              >
                <Space>
                  <Checkbox
                    checked={selectedFiles.has(file.path)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectFile(file.path, e.target.checked);
                    }}
                  />
                  {getStatusIcon(file.status)}
                  <span>{file.path}</span>
                  {getStatusTag(file.status)}
                  {file.oldPath && (
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      (from {file.oldPath})
                    </span>
                  )}
                </Space>
              </List.Item>
            )}
            locale={{ emptyText: 'No staged files' }}
          />
        </div>

        <Divider />

        {/* Unstaged Files */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px' 
          }}>
            <Space>
              <Checkbox
                checked={unstagedFiles.length > 0 && unstagedSelected.length === unstagedFiles.length}
                indeterminate={unstagedSelected.length > 0 && unstagedSelected.length < unstagedFiles.length}
                onChange={(e) => handleSelectAll(false, e.target.checked)}
              />
              <strong>Changes ({unstagedFiles.length})</strong>
            </Space>
            {unstagedSelected.length > 0 && (
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleStageFiles(unstagedSelected.map(f => f.path))}
              >
                Stage Selected ({unstagedSelected.length})
              </Button>
            )}
          </div>
          <List
            size="small"
            bordered
            dataSource={unstagedFiles}
            renderItem={(file) => (
              <List.Item
                style={{ padding: '8px 12px', cursor: onFileClick ? 'pointer' : 'default' }}
                onClick={() => onFileClick && onFileClick(file)}
                actions={[
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStageFiles([file.path]);
                    }}
                  >
                    Stage
                  </Button>
                ]}
              >
                <Space>
                  <Checkbox
                    checked={selectedFiles.has(file.path)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectFile(file.path, e.target.checked);
                    }}
                  />
                  {getStatusIcon(file.status)}
                  <span>{file.path}</span>
                  {getStatusTag(file.status)}
                </Space>
              </List.Item>
            )}
            locale={{ emptyText: 'No changes' }}
          />
        </div>
      </div>

      {/* Commit Section */}
      <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: '16px' }}>
        <TextArea
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={3}
          style={{ marginBottom: '8px' }}
        />
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={handleCommit}
          disabled={stagedFiles.length === 0 || !commitMessage.trim()}
          block
        >
          Commit ({stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
};

export default ChangesPanel;
