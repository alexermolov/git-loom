import React, { useState } from 'react';
import { Empty, Tree, Segmented } from 'antd';
import { BranchesOutlined, CheckCircleOutlined, ClockCircleOutlined, UnorderedListOutlined, PartitionOutlined } from '@ant-design/icons';
import { BranchInfo } from '../types';
import type { DataNode } from 'antd/es/tree';
import GitGraphView from './GitGraphView';

interface BranchTreePanelProps {
  repoPath: string;
  branches: BranchInfo[];
  currentBranch: string;
}

const BranchTreePanel: React.FC<BranchTreePanelProps> = ({ repoPath, branches, currentBranch }) => {
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  const convertToAntdTree = (branch: BranchInfo): DataNode => {
    const isCurrent = branch.name === currentBranch;
    const isRemote = branch.name.startsWith('remotes/');
    
    // Format branch name for display
    const displayName = isRemote 
      ? branch.name.replace('remotes/', '') 
      : branch.name;
    
    // Create title with status icons
    const title = (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isCurrent && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
        <span style={{ 
          fontWeight: isCurrent ? 600 : 400,
          color: isCurrent ? '#1890ff' : isRemote ? '#8c8c8c' : 'inherit'
        }}>
          {displayName}
        </span>
        {branch.lastCommitDate && (
          <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 4 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(branch.lastCommitDate).toLocaleDateString()}
          </span>
        )}
      </span>
    );

    return {
      title,
      key: branch.name,
      icon: <BranchesOutlined style={{ color: isCurrent ? '#1890ff' : '#8c8c8c' }} />,
      isLeaf: true,
    };
  };

  if (!branches || branches.length === 0) {
    return (
      <div className="branch-tree-panel">
        <Empty description="No branches available" />
      </div>
    );
  }

  // Separate local and remote branches
  const localBranches = branches.filter(b => !b.name.startsWith('remotes/'));
  const remoteBranches = branches.filter(b => b.name.startsWith('remotes/'));

  // Create tree structure with local and remote groups
  const treeData: DataNode[] = [];

  if (localBranches.length > 0) {
    treeData.push({
      title: <strong>Local Branches ({localBranches.length})</strong>,
      key: 'local',
      icon: <BranchesOutlined />,
      children: localBranches.map(convertToAntdTree),
      selectable: false,
    });
  }

  if (remoteBranches.length > 0) {
    treeData.push({
      title: <strong>Remote Branches ({remoteBranches.length})</strong>,
      key: 'remote',
      icon: <BranchesOutlined />,
      children: remoteBranches.map(convertToAntdTree),
      selectable: false,
    });
  }

  return (
    <div className="branch-tree-panel">
      <div style={{ 
        marginBottom: 16, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ 
          fontWeight: 600, 
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-primary)'
        }}>
          <BranchesOutlined />
          Git Branches
        </div>
        <Segmented
          value={viewMode}
          onChange={(val) => setViewMode(val as 'list' | 'graph')}
          options={[
            { label: 'List', value: 'list', icon: <UnorderedListOutlined /> },
            { label: 'Graph', value: 'graph', icon: <PartitionOutlined /> },
          ]}
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        />
      </div>
      
      {viewMode === 'list' ? (
        <Tree
          showIcon
          defaultExpandAll
          treeData={treeData}
          selectable={false}
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        />
      ) : (
        <GitGraphView repoPath={repoPath} branches={branches} />
      )}
    </div>
  );
};

export default BranchTreePanel;
