import React, { useState } from 'react';
import { Empty, List, Segmented, Tag, Tooltip, Tree } from 'antd';
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FileOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { CommitFile } from '../types';

interface CommitFilesPanelProps {
  files: CommitFile[];
  commitHash: string;
  onBack?: () => void;
  onFileClick?: (file: CommitFile) => void;
  selectedFile?: CommitFile | null;
  loadingFile?: boolean;
}

type ViewMode = 'compact' | 'tree';

interface FileTreeNode {
  key: string;
  title: string;
  fullPath: string;
  children?: FileTreeNode[];
  file?: CommitFile;
  isLeaf?: boolean;
}

const CommitFilesPanel: React.FC<CommitFilesPanelProps> = ({ files, commitHash, onBack, onFileClick, selectedFile, loadingFile }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('compact');

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

  const splitPath = (fullPath: string) => {
    const normalized = fullPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1] || normalized;
    const parentPath = parts.slice(0, -1).join('/');

    return { fileName, parentPath };
  };

  const buildTreeData = (items: CommitFile[]): FileTreeNode[] => {
    const root: FileTreeNode[] = [];

    const upsertNode = (
      nodes: FileTreeNode[],
      segment: string,
      fullPath: string,
      isLeaf: boolean,
      file?: CommitFile,
    ) => {
      let node = nodes.find((entry) => entry.title === segment);

      if (!node) {
        node = {
          key: fullPath,
          title: segment,
          fullPath,
          isLeaf,
          children: isLeaf ? undefined : [],
          file,
        };
        nodes.push(node);
      }

      if (isLeaf) {
        node.isLeaf = true;
        node.file = file;
        node.children = undefined;
      } else if (!node.children) {
        node.children = [];
      }

      return node;
    };

    for (const file of items) {
      const normalizedPath = file.path.replace(/\\/g, '/');
      const segments = normalizedPath.split('/').filter(Boolean);
      let currentNodes = root;
      let currentPath = '';

      segments.forEach((segment, index) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        const isLeaf = index === segments.length - 1;
        const node = upsertNode(currentNodes, segment, currentPath, isLeaf, isLeaf ? file : undefined);

        if (!isLeaf) {
          currentNodes = node.children || [];
          node.children = currentNodes;
        }
      });
    }

    const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes
        .map((node) => ({
          ...node,
          children: node.children ? sortNodes(node.children) : undefined,
        }))
        .sort((left, right) => {
          if (!!left.isLeaf !== !!right.isLeaf) {
            return left.isLeaf ? 1 : -1;
          }

          return left.title.localeCompare(right.title);
        });
    };

    return sortNodes(Array.from(root.values()));
  };

  const renderPathContent = (file: CommitFile, isSelected: boolean) => {
    const { fileName, parentPath } = splitPath(file.path);
    const isLoading = isSelected && loadingFile;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {getStatusIcon(file.status)}
          <div style={{ minWidth: 0, flex: 1 }}>
            <Tooltip title={file.path} mouseEnterDelay={0.35}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  minWidth: 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontWeight: isSelected ? 700 : 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flexShrink: 0,
                  }}
                >
                  {fileName}
                </span>
                {parentPath && (
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {parentPath}
                  </span>
                )}
              </div>
            </Tooltip>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              <span style={{ color: '#52c41a' }}>+{file.additions}</span>
              {' '}
              <span style={{ color: '#ff4d4f' }}>-{file.deletions}</span>
              {isLoading && <span style={{ marginLeft: 8 }}>Loading...</span>}
            </div>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {getStatusTag(file.status)}
        </div>
      </div>
    );
  };

  const renderTreeTitle = (node: FileTreeNode) => {
    if (!node.file) {
      return (
        <Tooltip title={node.fullPath} mouseEnterDelay={0.35}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <FolderOpenOutlined style={{ color: 'var(--text-secondary)' }} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.title}
            </span>
          </div>
        </Tooltip>
      );
    }

    const isSelected = selectedFile?.path === node.file.path;
    return (
      <div
        onClick={(event) => {
          event.stopPropagation();
          onFileClick?.(node.file!);
        }}
      >
        {renderPathContent(node.file, isSelected)}
      </div>
    );
  };

  const treeData = buildTreeData(files);

  if (!files || files.length === 0) {
    return (
      <div className="commit-files-panel">
        <Empty description="No files changed in this commit" />
      </div>
    );
  }

  return (
    <div className="commit-files-panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 8,
          color: 'var(--text-primary)',
          padding: '0 16px',
        }}
      >
        <span>Changed Files ({files.length})</span>
        <Segmented
          size="small"
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          options={[
            { value: 'compact', icon: <FileOutlined />, label: 'List' },
            { value: 'tree', icon: <ApartmentOutlined />, label: 'Tree' },
          ]}
        />
      </div>
      {!selectedFile && (
        <div style={{ 
          padding: '8px 16px', 
          marginBottom: 8, 
          backgroundColor: 'var(--info-bg)', 
          borderLeft: '3px solid var(--primary-color)',
          fontSize: 12,
          color: 'var(--text-secondary)'
        }}>
          💡 Click on a file to view its changes
        </div>
      )}

      {viewMode === 'compact' ? (
        <List
          dataSource={files}
          renderItem={file => {
            const isSelected = selectedFile?.path === file.path;
            const isLoading = isSelected && loadingFile;
            return (
              <List.Item 
                className="commit-file-item"
                onClick={() => onFileClick && onFileClick(file)}
                style={{ 
                  cursor: 'pointer',
                  padding: '12px 16px',
                  transition: 'background-color 0.2s',
                  backgroundColor: isSelected ? 'var(--primary-bg-hover)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {renderPathContent(file, isSelected)}
              </List.Item>
            );
          }}
        />
      ) : (
        <div style={{ padding: '0 8px 12px' }}>
          <Tree
            blockNode
            selectable={false}
            defaultExpandAll
            treeData={treeData as any}
            titleRender={(node) => renderTreeTitle(node as FileTreeNode)}
          />
        </div>
      )}
    </div>
  );
};

export default CommitFilesPanel;
