import React from 'react';
import { Empty, Tree, Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';
import { BranchesOutlined, CheckCircleOutlined, ClockCircleOutlined, MergeCellsOutlined, SwapOutlined } from '@ant-design/icons';
import { BranchInfo } from '../types';
import type { DataNode } from 'antd/es/tree';

interface BranchTreePanelProps {
  repoPath: string;
  branches: BranchInfo[];
  currentBranch: string;
  onCheckoutBranch?: (branchName: string) => void;
  onMergeBranch?: (branchName: string) => void;
}

const BranchTreePanel: React.FC<BranchTreePanelProps> = ({ repoPath, branches, currentBranch, onCheckoutBranch, onMergeBranch }) => {
  const handleBranchAction = (action: 'checkout' | 'merge', branchName: string, displayName: string) => {
    const isCurrent = branchName === currentBranch;
    
    if (action === 'checkout') {
      if (isCurrent) {
        Modal.info({
          title: 'Branch Already Active',
          content: `You are already on branch "${displayName}".`,
        });
        return;
      }
      
      Modal.confirm({
        title: 'Checkout Branch',
        content: `Switch to branch "${displayName}"?`,
        okText: 'Checkout',
        cancelText: 'Cancel',
        onOk: () => {
          onCheckoutBranch?.(branchName);
        },
      });
    } else if (action === 'merge') {
      if (isCurrent) {
        Modal.info({
          title: 'Cannot Merge',
          content: `Cannot merge branch "${displayName}" into itself.`,
        });
        return;
      }
      
      Modal.confirm({
        title: 'Merge Branch',
        content: `Merge branch "${displayName}" into current branch "${currentBranch}"?`,
        okText: 'Merge',
        cancelText: 'Cancel',
        onOk: () => {
          onMergeBranch?.(branchName);
        },
      });
    }
  };

  const getContextMenu = (branch: BranchInfo): MenuProps => {
    const isCurrent = branch.name === currentBranch;
    const isRemote = branch.name.startsWith('remotes/');
    const displayName = branch.name.startsWith('remotes/') 
      ? branch.name.replace('remotes/', '') 
      : branch.name;
    
    return {
      items: [
        {
          key: 'checkout',
          label: isCurrent ? 'Current Branch' : 'Checkout',
          icon: <SwapOutlined />,
          disabled: isCurrent,
          onClick: () => handleBranchAction('checkout', branch.name, displayName),
        },
        {
          key: 'merge',
          label: 'Merge into Current',
          icon: <MergeCellsOutlined />,
          disabled: isCurrent,
          onClick: () => handleBranchAction('merge', branch.name, displayName),
        },
      ],
    };
  };

  const convertToAntdTree = (branch: BranchInfo): DataNode => {
    const isCurrent = branch.name === currentBranch;
    const isRemote = branch.name.startsWith('remotes/');
    
    // Format branch name for display
    const displayName = isRemote 
      ? branch.name.replace('remotes/', '') 
      : branch.name;
    
    // Create title with status icons
    const title = (
      <Dropdown menu={getContextMenu(branch)} trigger={['contextMenu']}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'context-menu' }}>
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
      </Dropdown>
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
    <div className="branch-tree-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ 
        marginBottom: 16, 
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        flexShrink: 0
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
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tree
          showIcon
          defaultExpandAll
          treeData={treeData}
          selectable={false}
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  );
};

export default BranchTreePanel;
