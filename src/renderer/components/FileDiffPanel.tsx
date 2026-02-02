import React, { useState, useEffect } from 'react';
import { Button, Empty, Space, Tag, Tooltip, Modal, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, MinusOutlined, WarningOutlined, CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { FileDiff, ConflictFile, ConflictMarker } from '../types';

interface FileDiffPanelProps {
  diff: FileDiff | null;
  onBack: () => void;
  repoPath?: string | null;
  filePath?: string;
  onRefresh?: () => void;
}

const FileDiffPanel: React.FC<FileDiffPanelProps> = ({ diff, onBack, repoPath, filePath, onRefresh }) => {
  const [conflictInfo, setConflictInfo] = useState<ConflictFile | null>(null);
  const [resolving, setResolving] = useState(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadConflicts();
  }, [repoPath, filePath]);

  const loadConflicts = async () => {
    if (!repoPath || !filePath) return;

    try {
      const conflicts = await window.electronAPI.getFileConflicts(repoPath, filePath);
      if (conflicts.conflicts.length > 0) {
        setConflictInfo(conflicts);
        setEditingContent(conflicts.content);
      } else {
        setConflictInfo(null);
      }
    } catch (error) {
      // File might not have conflicts, that's ok
      setConflictInfo(null);
    }
  };

  const handleResolveConflict = async (conflictIndex: number, resolution: 'ours' | 'theirs' | 'both') => {
    if (!repoPath || !filePath) return;

    setResolving(true);
    try {
      await window.electronAPI.resolveConflict(repoPath, filePath, resolution, conflictIndex);
      message.success(`Conflict ${conflictIndex + 1} resolved using "${resolution}"`);
      await loadConflicts();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error resolving conflict:', error);
      message.error(`Failed to resolve conflict: ${error}`);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveAllConflicts = async (resolution: 'ours' | 'theirs' | 'both') => {
    if (!repoPath || !filePath) return;

    Modal.confirm({
      title: `Resolve All Conflicts`,
      content: `Are you sure you want to resolve all conflicts in this file using "${resolution}"?`,
      okText: 'Resolve All',
      cancelText: 'Cancel',
      onOk: async () => {
        setResolving(true);
        try {
          await window.electronAPI.resolveConflict(repoPath, filePath, resolution);
          message.success(`All conflicts resolved using "${resolution}"`);
          await loadConflicts();
          if (onRefresh) onRefresh();
        } catch (error) {
          console.error('Error resolving all conflicts:', error);
          message.error(`Failed to resolve conflicts: ${error}`);
        } finally {
          setResolving(false);
        }
      },
    });
  };

  const handleManualResolve = () => {
    setShowEditModal(true);
  };

  const handleSaveManualResolve = async () => {
    if (!repoPath || !filePath || !editingContent) return;

    setResolving(true);
    try {
      await window.electronAPI.resolveConflictManual(repoPath, filePath, editingContent);
      message.success('File resolved and staged successfully');
      setShowEditModal(false);
      await loadConflicts();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error saving manual resolution:', error);
      message.error(`Failed to save resolution: ${error}`);
    } finally {
      setResolving(false);
    }
  };

  const handleLaunchMergeTool = async () => {
    if (!repoPath || !filePath) return;

    try {
      await window.electronAPI.launchMergeTool(repoPath, filePath);
      message.success('Launched external merge tool');
      setTimeout(() => {
        loadConflicts();
        if (onRefresh) onRefresh();
      }, 2000);
    } catch (error) {
      console.error('Error launching merge tool:', error);
      message.error(`Failed to launch merge tool: ${error}`);
    }
  };

  const isDiff = diff && (diff.additions > 0 || diff.deletions > 0 || diff.diff.includes('@@'));
  const hasConflicts = conflictInfo && conflictInfo.conflicts.length > 0;
  
  const renderDiffLine = (line: string, index: number) => {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    let backgroundColor = 'transparent';
    let color = 'inherit';
    let icon = null;
    let isConflictMarker = false;

    // Check for conflict markers
    if (line.startsWith('<<<<<<<') || line.startsWith('=======') || line.startsWith('>>>>>>>') || line.startsWith('|||||||')) {
      backgroundColor = isDarkTheme ? '#4a2a2a' : '#fff1f0';
      color = '#ff4d4f';
      isConflictMarker = true;
      icon = <WarningOutlined style={{ fontSize: 10, marginRight: 8 }} />;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
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
          borderLeft: isConflictMarker
            ? '3px solid #ff4d4f'
            : line.startsWith('+') && !line.startsWith('+++') 
            ? '3px solid #52c41a' 
            : line.startsWith('-') && !line.startsWith('---')
            ? '3px solid #ff4d4f'
            : 'none',
          fontWeight: isConflictMarker ? 600 : 'normal',
        }}
      >
        {icon}
        {line}
      </div>
    );
  };

  const renderConflictBlock = (conflict: ConflictMarker, conflictIndex: number) => {
    const isDarkTheme = document.body.classList.contains('dark-theme');

    return (
      <div
        key={`conflict-${conflictIndex}`}
        style={{
          margin: '16px 0',
          border: '2px solid #ff4d4f',
          borderRadius: 8,
          backgroundColor: isDarkTheme ? '#2a1a1a' : '#fff7f7',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#ff4d4f',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WarningOutlined />
            <span style={{ fontWeight: 600 }}>Conflict {conflictIndex + 1}</span>
          </div>
          <Space size="small">
            <Tooltip title="Accept your changes (HEAD)">
              <Button
                size="small"
                type="primary"
                ghost
                loading={resolving}
                onClick={() => handleResolveConflict(conflictIndex, 'ours')}
                style={{ borderColor: 'white', color: 'white' }}
              >
                Ours
              </Button>
            </Tooltip>
            <Tooltip title="Accept their changes (incoming)">
              <Button
                size="small"
                type="primary"
                ghost
                loading={resolving}
                onClick={() => handleResolveConflict(conflictIndex, 'theirs')}
                style={{ borderColor: 'white', color: 'white' }}
              >
                Theirs
              </Button>
            </Tooltip>
            <Tooltip title="Accept both changes">
              <Button
                size="small"
                type="primary"
                ghost
                loading={resolving}
                onClick={() => handleResolveConflict(conflictIndex, 'both')}
                style={{ borderColor: 'white', color: 'white' }}
              >
                Both
              </Button>
            </Tooltip>
          </Space>
        </div>

        <div style={{ padding: 12 }}>
          {/* Current (HEAD) section */}
          <div style={{ marginBottom: 12 }}>
            <Tag color="blue" style={{ marginBottom: 8 }}>
              Current Changes (HEAD)
            </Tag>
            <div
              style={{
                backgroundColor: isDarkTheme ? '#1a3a1a' : '#f6ffed',
                padding: 8,
                borderRadius: 4,
                border: '1px solid #52c41a',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 13,
                  color: '#52c41a',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {conflict.currentContent || '(empty)'}
              </pre>
            </div>
          </div>

          {/* Base section (if available) */}
          {conflict.baseContent && (
            <div style={{ marginBottom: 12 }}>
              <Tag color="default" style={{ marginBottom: 8 }}>
                Base (Common Ancestor)
              </Tag>
              <div
                style={{
                  backgroundColor: isDarkTheme ? '#2a2a2a' : '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #d9d9d9',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {conflict.baseContent}
                </pre>
              </div>
            </div>
          )}

          {/* Incoming section */}
          <div>
            <Tag color="orange" style={{ marginBottom: 8 }}>
              Incoming Changes
            </Tag>
            <div
              style={{
                backgroundColor: isDarkTheme ? '#3a2a1a' : '#fffbe6',
                padding: 8,
                borderRadius: 4,
                border: '1px solid #faad14',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 13,
                  color: '#faad14',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {conflict.incomingContent || '(empty)'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContentLine = (line: string, index: number) => {
    return (
      <div
        key={index}
        style={{
          padding: '2px 8px',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: 13,
          lineHeight: '20px',
          whiteSpace: 'pre',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ 
          display: 'inline-block', 
          minWidth: '40px', 
          textAlign: 'right',
          marginRight: '12px',
          color: 'var(--text-secondary)',
          userSelect: 'none',
        }}>
          {index + 1}
        </span>
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
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
              {diff.path}
            </div>
            {hasConflicts && (
              <Tag icon={<WarningOutlined />} color="error">
                {conflictInfo.conflicts.length} Conflict{conflictInfo.conflicts.length > 1 ? 's' : ''}
              </Tag>
            )}
          </div>
          {isDiff && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: '#52c41a', marginRight: 8 }}>
                +{diff.additions}
              </span>
              <span style={{ color: '#ff4d4f' }}>
                -{diff.deletions}
              </span>
            </div>
          )}
        </div>

        {/* Conflict resolution toolbar */}
        {hasConflicts && (
          <Space wrap style={{ marginTop: 12 }}>
            <Tooltip title="Resolve all conflicts by accepting your changes">
              <Button
                size="small"
                type="primary"
                loading={resolving}
                onClick={() => handleResolveAllConflicts('ours')}
              >
                Accept All Ours
              </Button>
            </Tooltip>
            <Tooltip title="Resolve all conflicts by accepting their changes">
              <Button
                size="small"
                type="primary"
                loading={resolving}
                onClick={() => handleResolveAllConflicts('theirs')}
              >
                Accept All Theirs
              </Button>
            </Tooltip>
            <Tooltip title="Resolve all conflicts by keeping both changes">
              <Button
                size="small"
                type="primary"
                loading={resolving}
                onClick={() => handleResolveAllConflicts('both')}
              >
                Accept All Both
              </Button>
            </Tooltip>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={handleManualResolve}
            >
              Edit Manually
            </Button>
            <Button
              size="small"
              onClick={handleLaunchMergeTool}
            >
              Launch Merge Tool
            </Button>
          </Space>
        )}
      </div>

      {/* Show conflict blocks if available */}
      {hasConflicts && (
        <div style={{ marginBottom: 16 }}>
          {conflictInfo.conflicts.map((conflict, index) => renderConflictBlock(conflict, index))}
        </div>
      )}

      {/* Show diff */}
      <div style={{ 
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        overflow: 'auto',
      }}>
        {diffLines.map((line, index) => isDiff ? renderDiffLine(line, index) : renderContentLine(line, index))}
      </div>

      {/* Manual edit modal */}
      <Modal
        title="Manually Resolve Conflicts"
        open={showEditModal}
        onCancel={() => setShowEditModal(false)}
        onOk={handleSaveManualResolve}
        width={800}
        confirmLoading={resolving}
        okText="Save & Stage"
        cancelText="Cancel"
      >
        <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
          Edit the file content below to resolve conflicts manually. When saved, the file will be staged automatically.
        </div>
        <textarea
          value={editingContent || ''}
          onChange={(e) => setEditingContent(e.target.value)}
          style={{
            width: '100%',
            height: 400,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: 13,
            padding: 8,
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
        />
      </Modal>
    </div>
  );
};

export default FileDiffPanel;
