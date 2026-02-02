import React, { useState, useEffect } from 'react';
import { Empty, Tree, Spin, message } from 'antd';
import { FileOutlined, FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { FileTreeNode } from '../types';
import type { DataNode } from 'antd/es/tree';

interface FileTreePanelProps {
  repoPath: string;
  onFileClick?: (filePath: string) => void;
}

const FileTreePanel: React.FC<FileTreePanelProps> = ({ repoPath, onFileClick }) => {
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (repoPath) {
      loadFileTree();
    }
  }, [repoPath]);

  const loadFileTree = async () => {
    setLoading(true);
    try {
      const tree = await window.electronAPI.getFileTree(repoPath);
      setFileTree(tree);
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

  const treeData = fileTree.children?.map(convertToAntdTree) || [];

  return (
    <div className="file-tree-panel" style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
      <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 16 }}>
        File Explorer
      </div>
      
      {treeData.length === 0 ? (
        <Empty description="No files found" />
      ) : (
        <Tree
          showIcon
          defaultExpandAll={false}
          treeData={treeData}
          switcherIcon={<FolderOpenOutlined />}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};

export default FileTreePanel;
