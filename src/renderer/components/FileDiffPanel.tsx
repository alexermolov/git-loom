import React from 'react';
import { Button, Empty } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { FileDiff } from '../types';

interface FileDiffPanelProps {
  diff: FileDiff | null;
  onBack: () => void;
}

const FileDiffPanel: React.FC<FileDiffPanelProps> = ({ diff, onBack }) => {
  const renderDiffLine = (line: string, index: number) => {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    let backgroundColor = 'transparent';
    let color = 'inherit';
    let icon = null;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      backgroundColor = isDarkTheme ? '#1a3a1a' : '#f6ffed';
      color = '#52c41a';
      icon = <PlusOutlined style={{ fontSize: 10, marginRight: 8 }} />;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      backgroundColor = isDarkTheme ? '#3a1a1a' : '#fff2f0';
      color = '#ff4d4f';
      icon = <MinusOutlined style={{ fontSize: 10, marginRight: 8 }} />;
    } else if (line.startsWith('@@')) {
      backgroundColor = isDarkTheme ? '#1a2a3a' : '#e6f7ff';
      color = '#1890ff';
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      color = isDarkTheme ? '#a0a0a0' : '#8c8c8c';
      fontWeight: 600;
    }

    return (
      <div
        key={index}
        style={{
          backgroundColor,
          color,
          padding: '2px 8px',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: 13,
          lineHeight: '20px',
          whiteSpace: 'pre',
          borderLeft: line.startsWith('+') && !line.startsWith('+++') 
            ? '3px solid #52c41a' 
            : line.startsWith('-') && !line.startsWith('---')
            ? '3px solid #ff4d4f'
            : 'none',
        }}
      >
        {icon}
        {line}
      </div>
    );
  };

  if (!diff) {
    return (
      <div className="file-diff-panel">
        <div style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            Back to Files
          </Button>
        </div>
        <Empty description="No diff available" />
      </div>
    );
  }

  const diffLines = diff.diff.split('\n');

  return (
    <div className="file-diff-panel">
      <div style={{ 
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-light)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 12 }}>
          Back to Files
        </Button>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
            {diff.path}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#52c41a', marginRight: 8 }}>
              +{diff.additions}
            </span>
            <span style={{ color: '#ff4d4f' }}>
              -{diff.deletions}
            </span>
          </div>
        </div>
      </div>

      <div style={{ 
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        overflow: 'auto',
      }}>
        {diffLines.map((line, index) => renderDiffLine(line, index))}
      </div>
    </div>
  );
};

export default FileDiffPanel;
