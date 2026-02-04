import React, { useState, useEffect } from 'react';
import { Button, Spin, Empty, Segmented, Tooltip, message } from 'antd';
import { 
  ArrowLeftOutlined, 
  HistoryOutlined, 
  FileTextOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import { useTheme } from '../ThemeContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface BlameLine {
  lineNumber: number;
  hash: string;
  author: string;
  date: string;
  content: string;
  summary: string;
}

interface FileEditorPanelProps {
  repoPath: string;
  filePath: string;
  onBack: () => void;
  onCommitClick?: (commitHash: string) => void;
}

const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  repoPath,
  filePath,
  onBack,
  onCommitClick,
}) => {
  const { isDarkMode } = useTheme();
  const [content, setContent] = useState<string>('');
  const [blameData, setBlameData] = useState<BlameLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'content' | 'blame'>('content');
  const [loadingBlame, setLoadingBlame] = useState(false);

  useEffect(() => {
    loadFileContent();
  }, [repoPath, filePath]);

  const loadFileContent = async () => {
    setLoading(true);
    try {
      const fileContent = await window.electronAPI.getFileContent(repoPath, filePath);
      setContent(fileContent);
    } catch (error) {
      console.error('Error loading file content:', error);
      message.error('Failed to load file content');
    } finally {
      setLoading(false);
    }
  };

  const loadBlameData = async () => {
    if (blameData.length > 0) return; // Already loaded
    
    setLoadingBlame(true);
    try {
      const blame = await window.electronAPI.getFileBlame(repoPath, filePath);
      setBlameData(blame);
    } catch (error) {
      console.error('Error loading blame data:', error);
      message.error('Failed to load blame data');
    } finally {
      setLoadingBlame(false);
    }
  };

  const handleViewModeChange = (value: string | number) => {
    const mode = value as 'content' | 'blame';
    setViewMode(mode);
    if (mode === 'blame' && blameData.length === 0) {
      loadBlameData();
    }
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash',
      'sql': 'sql',
    };
    return langMap[ext] || 'text';
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const renderBlameView = () => {
    if (loadingBlame) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Spin tip="Loading blame data..." />
        </div>
      );
    }

    if (blameData.length === 0) {
      return (
        <Empty 
          description="No blame data available"
          style={{ marginTop: 40 }}
        />
      );
    }

    return (
      <div style={{ 
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: '20px',
      }}>
        {blameData.map((line: BlameLine, idx: number) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: idx % 2 === 0 
                ? (isDarkMode ? '#1e1e1e' : '#fafafa')
                : (isDarkMode ? '#252526' : '#ffffff'),
            }}
          >
            {/* Blame info column */}
            <div
              style={{
                width: 350,
                padding: '4px 8px',
                borderRight: '1px solid var(--border-color)',
                backgroundColor: isDarkMode ? '#2d2d30' : '#f5f5f5',
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ 
                color: 'var(--text-secondary)', 
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Tooltip title={line.summary}>
                  <span 
                    onClick={() => onCommitClick?.(line.hash)}
                    style={{ 
                      fontWeight: 600,
                      color: isDarkMode ? '#4ec9b0' : '#0066cc',
                      cursor: 'pointer',
                      maxWidth: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textDecoration: onCommitClick ? 'underline' : 'none',
                      textDecorationStyle: 'dotted',
                    }}
                    onMouseEnter={(e) => {
                      if (onCommitClick) {
                        e.currentTarget.style.textDecoration = 'underline';
                        e.currentTarget.style.textDecorationStyle = 'solid';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (onCommitClick) {
                        e.currentTarget.style.textDecoration = 'underline';
                        e.currentTarget.style.textDecorationStyle = 'dotted';
                      }
                    }}
                  >
                    {line.hash.substring(0, 7)}
                  </span>
                </Tooltip>
                <span style={{ color: 'var(--text-secondary)' }}>•</span>
                <span style={{ 
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {line.author}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>•</span>
                <span>{formatDate(line.date)}</span>
              </div>
              <div style={{ 
                fontSize: 10,
                color: 'var(--text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {line.summary}
              </div>
            </div>

            {/* Line number */}
            <div
              style={{
                width: 50,
                padding: '4px 8px',
                textAlign: 'right',
                color: 'var(--text-tertiary)',
                backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
                borderRight: '1px solid var(--border-color)',
              }}
            >
              {line.lineNumber}
            </div>

            {/* Code content */}
            <div
              style={{
                flex: 1,
                padding: '4px 12px',
                whiteSpace: 'pre',
                overflowX: 'auto',
                color: 'var(--text-primary)',
              }}
            >
              {line.content}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%' 
      }}>
        <Spin tip="Loading file..." size="large" />
      </div>
    );
  }

  const fileName = filePath.split('/').pop() || filePath;
  const language = getLanguageFromPath(filePath);

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack}
            size="small"
          >
            Back
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ fontSize: 18, color: 'var(--text-secondary)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{fileName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{filePath}</div>
            </div>
          </div>
        </div>

        <Segmented
          value={viewMode}
          onChange={handleViewModeChange}
          options={[
            {
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileTextOutlined />
                  Content
                </span>
              ),
              value: 'content',
            },
            {
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HistoryOutlined />
                  Blame
                </span>
              ),
              value: 'blame',
            },
          ]}
        />
      </div>

      {/* Info banner for blame view */}
      {viewMode === 'blame' && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: isDarkMode ? '#252526' : '#f0f8ff',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          <InfoCircleOutlined />
          <span>
            Git Blame shows who last modified each line and when. Click on commit hash to see details.
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
      }}>
        {viewMode === 'content' ? (
          <SyntaxHighlighter
            language={language}
            style={isDarkMode ? vscDarkPlus : vs}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              padding: 16,
              fontSize: 13,
              lineHeight: '20px',
              backgroundColor: 'transparent',
            }}
            lineNumberStyle={{
              minWidth: '3em',
              paddingRight: '1em',
              textAlign: 'right',
              color: 'var(--text-tertiary)',
              userSelect: 'none',
            }}
          >
            {content}
          </SyntaxHighlighter>
        ) : (
          renderBlameView()
        )}
      </div>
    </div>
  );
};

export default FileEditorPanel;
