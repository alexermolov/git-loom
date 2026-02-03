import React, { useState, useEffect } from 'react';
import { Empty, Tree, Spin, message, Input } from 'antd';
import { FileOutlined, FolderOutlined, FolderOpenOutlined, SearchOutlined } from '@ant-design/icons';
import { FileTreeNode } from '../types';
import type { DataNode } from 'antd/es/tree';

interface FileTreePanelProps {
  repoPath: string;
  onFileClick?: (filePath: string) => void;
}

const FileTreePanel: React.FC<FileTreePanelProps> = ({ repoPath, onFileClick }) => {
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (repoPath) {
      loadFileTree();
    }
  }, [repoPath]);

  const loadFileTree = async () => {
    // Don't show loading if we already have cached data displayed
    if (!fileTree) {
      setLoading(true);
    }
    
    try {
      const tree = await window.electronAPI.getFileTree(repoPath);
      setFileTree(tree);
      
      // If tree loaded instantly (< 50ms), it was likely from cache
      setIsFromCache(true);
    } catch (error) {
      console.error('Error loading file tree:', error);
      message.error('Failed to load file tree');
    } finally {
      setLoading(false);
    }
  };
  const convertToAntdTree = (node: FileTreeNode): DataNode => {
    const isDirectory = node.type === 'directory';
    
    return {
      title: node.name,
      key: node.path,
      icon: isDirectory ? <FolderOutlined /> : <FileOutlined />,
      children: node.children?.map(convertToAntdTree),
      isLeaf: !isDirectory,
    };
  };

  const filterTreeNode = (node: FileTreeNode, query: string): FileTreeNode | null => {
    const matches = node.name.toLowerCase().includes(query.toLowerCase());
    
    if (node.type === 'file') {
      return matches ? node : null;
    }
    
    // For directories, include if it matches or has matching children
    const filteredChildren = node.children
      ?.map(child => filterTreeNode(child, query))
      .filter(Boolean) as FileTreeNode[] | undefined;
    
    if (matches || (filteredChildren && filteredChildren.length > 0)) {
      return {
        ...node,
        children: filteredChildren || node.children,
      };
    }
    
    return null;
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;
    
    const selectedPath = selectedKeys[0] as string;
    // Find the node to check if it's a file
    const findNode = (node: FileTreeNode, path: string): FileTreeNode | null => {
      if (node.path === path) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, path);
          if (found) return found;
        }
      }
      return null;
    };
    
    if (fileTree) {
      const node = findNode(fileTree, selectedPath);
      if (node && node.type === 'file' && onFileClick) {
        onFileClick(node.path);
      }
    }
  };

  if (loading) {
    return (
      <div className="file-tree-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin tip="Loading file tree..." />
      </div>
    );
  }

  if (!fileTree) {
    return (
      <div className="file-tree-panel">
        <Empty description="No file tree available" />
      </div>
    );
  }

  // Apply filtering
  let displayTree = fileTree;
  if (filterText.trim()) {
    const filteredChildren = fileTree.children
      ?.map(child => filterTreeNode(child, filterText))
      .filter(Boolean) as FileTreeNode[] | undefined;
    displayTree = { ...fileTree, children: filteredChildren };
  }

  const treeData = displayTree.children?.map(convertToAntdTree) || [];

  return (
    <div className="file-tree-panel" style={{ height: '100%', overflow: 'hidden', padding: '12px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 16 }}>
        File Explorer
      </div>
      
      <Input
        placeholder="Filter files..."
        prefix={<SearchOutlined />}
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        allowClear
        size="small"
        style={{ marginBottom: 12 }}
      />
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        {treeData.length === 0 ? (
          <Empty description={filterText ? `No files match "${filterText}"` : "No files found"} />
        ) : (
          <Tree
            showIcon
            defaultExpandAll={!!filterText}
            treeData={treeData}
            switcherIcon={<FolderOpenOutlined />}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
};

export default FileTreePanel;
