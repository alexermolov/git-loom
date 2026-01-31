import React, { useState } from 'react';
import { Empty, Tree } from 'antd';
import { FileOutlined, FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { FileTreeNode } from '../types';
import type { DataNode } from 'antd/es/tree';

interface FileTreePanelProps {
  fileTree: FileTreeNode | null;
}

const FileTreePanel: React.FC<FileTreePanelProps> = ({ fileTree }) => {
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

  if (!fileTree) {
    return (
      <div className="file-tree-panel">
        <Empty description="No file tree available" />
      </div>
    );
  }

  const treeData = fileTree.children?.map(convertToAntdTree) || [];

  return (
    <div className="file-tree-panel">
      <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 16 }}>
        File Tree
      </div>
      
      {treeData.length === 0 ? (
        <Empty description="No files found" />
      ) : (
        <Tree
          showIcon
          defaultExpandAll={false}
          treeData={treeData}
          switcherIcon={<FolderOpenOutlined />}
        />
      )}
    </div>
  );
};

export default FileTreePanel;
