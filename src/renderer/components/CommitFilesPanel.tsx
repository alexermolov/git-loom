import React from 'react';
import { Button, Empty, List, Tag } from 'antd';
import { ArrowLeftOutlined, FileAddOutlined, FileOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { CommitFile } from '../types';

interface CommitFilesPanelProps {
  files: CommitFile[];
  commitHash: string;
  onBack?: () => void;
  onFileClick?: (file: CommitFile) => void;
}

const CommitFilesPanel: React.FC<CommitFilesPanelProps> = ({ files, commitHash, onBack, onFileClick }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <FileAddOutlined style={{ color: '#52c41a' }} />;
      case 'deleted':
        return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
      case 'modified':
        return <EditOutlined style={{ color: '#1890ff' }} />;
      case 'renamed':
        return <FileOutlined style={{ color: '#faad14' }} />;
      default:
        return <FileOutlined />;
    }
  };

  const getStatusTag = (status: string) => {
    const statusColors = {
      added: 'success',
      deleted: 'error',
      modified: 'processing',
      renamed: 'warning',
    };
    
    return (
      <Tag color={statusColors[status as keyof typeof statusColors]}>
        {status.toUpperCase()}
      </Tag>
    );
  };

  if (!files || files.length === 0) {
    return (
      <div className="commit-files-panel">
        <Empty description="No files changed in this commit" />
      </div>
    );
  }

  return (
    <div className="commit-files-panel">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)', padding: '0 16px' }}>
        Changed Files ({files.length})
      </div>

      <List
        dataSource={files}
        renderItem={file => (
          <List.Item 
            className="commit-file-item"
            onClick={() => onFileClick && onFileClick(file)}
            style={{ 
              cursor: 'pointer',
              padding: '12px 16px',
              transition: 'background-color 0.2s',
            }}
          >
            <List.Item.Meta
              avatar={getStatusIcon(file.status)}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{file.path}</span>
                  {getStatusTag(file.status)}
                </div>
              }
              description={
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#52c41a' }}>+{file.additions}</span>
                  {' '}
                  <span style={{ color: '#ff4d4f' }}>-{file.deletions}</span>
                </span>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default CommitFilesPanel;
