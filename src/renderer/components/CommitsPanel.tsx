import React from 'react';
import { Empty, message, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { CommitInfo } from '../types';

interface CommitsPanelProps {
  commits: CommitInfo[];
  onCommitClick?: (commit: CommitInfo) => void;
}

const CommitsPanel: React.FC<CommitsPanelProps> = ({ commits, onCommitClick }) => {
  const copyHashToClipboard = async (hash: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      message.success('Commit hash copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      message.error('Failed to copy commit hash');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatHash = (hash: string) => {
    return hash.substring(0, 7);
  };

  return (
    <div className="commits-panel">
      <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>
        Commits ({commits.length})
      </div>
      
      {commits.length === 0 ? (
        <div style={{ padding: 20 }}>
          <Empty description="No commits found" />
        </div>
      ) : (
        <div>
          {commits.map((commit) => (
            <div 
              key={commit.hash} 
              className="commit-item"
              onClick={() => onCommitClick && onCommitClick(commit)}
              style={{ cursor: onCommitClick ? 'pointer' : 'default' }}
            >
              <div className="commit-message">{commit.message}</div>
              <div className="commit-meta">
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tooltip title="Click to copy full hash">
                    <span 
                      className="commit-hash" 
                      onClick={(e) => copyHashToClipboard(commit.hash, e)}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {formatHash(commit.hash)}
                      <CopyOutlined style={{ fontSize: 11, opacity: 0.6 }} />
                    </span>
                  </Tooltip>
                  {commit.refs && (
                    <span style={{ marginLeft: 8, color: '#52c41a' }}>
                      {commit.refs}
                    </span>
                  )}
                </div>
                <div>{commit.author}</div>
                <div>{formatDate(commit.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommitsPanel;
