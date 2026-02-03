import React, { useState } from 'react';
import { Empty, Tree, Dropdown, Modal, Spin, Input } from 'antd';
import type { MenuProps } from 'antd';
import { BranchesOutlined, CheckCircleOutlined, ClockCircleOutlined, MergeCellsOutlined, SwapOutlined, SearchOutlined } from '@ant-design/icons';
import { BranchInfo } from '../types';
import type { DataNode } from 'antd/es/tree';

interface BranchTreePanelProps {
  repoPath: string;
  branches: BranchInfo[];
  currentBranch: string;
  onCheckoutBranch?: (branchName: string) => void;
  onMergeBranch?: (branchName: string) => void;
  loading?: boolean;
}

const BranchTreePanel: React.FC<BranchTreePanelProps> = ({ repoPath, branches, currentBranch, onCheckoutBranch, onMergeBranch, loading = false }) => {
  const [filterText, setFilterText] = useState('');

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

  const createBranchNode = (branch: BranchInfo, displayName: string): DataNode => {
    const isCurrent = branch.name === currentBranch;
    const isRemote = branch.name.startsWith('remotes/');
    
    // Create title with status icons
    const title = (
      <Dropdown menu={getContextMenu(branch)} trigger={['contextMenu']}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'context-menu' }}>
          <BranchesOutlined style={{ color: isCurrent ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
          {isCurrent && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
          <span style={{ 
            fontWeight: isCurrent ? 600 : 400,
            color: isCurrent ? 'var(--accent-color)' : isRemote ? 'var(--text-tertiary)' : 'var(--text-primary)'
          }}>
            {displayName}
          </span>
          {branch.lastCommitDate && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
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
      isLeaf: true,
    };
  };

  const buildBranchHierarchy = (branches: BranchInfo[], isRemote: boolean): DataNode[] => {
    // Group branches by folder structure
    interface BranchNode {
      branches: BranchInfo[];
      folders: Map<string, BranchNode>;
    }

    const root: BranchNode = { branches: [], folders: new Map() };

    branches.forEach(branch => {
      const displayName = isRemote 
        ? branch.name.replace('remotes/', '') 
        : branch.name;
      
      const parts = displayName.split('/');
      
      if (parts.length === 1) {
        // Branch without folder
        root.branches.push(branch);
      } else {
        // Branch with folder structure
        let currentNode = root;
        
        // Navigate through folders
        for (let i = 0; i < parts.length - 1; i++) {
          const folderName = parts[i];
          if (!currentNode.folders.has(folderName)) {
            currentNode.folders.set(folderName, { branches: [], folders: new Map() });
          }
          currentNode = currentNode.folders.get(folderName)!;
        }
        
        // Add branch to the final folder
        currentNode.branches.push(branch);
      }
    });

    // Convert to DataNode structure
    const convertNode = (node: BranchNode, pathPrefix: string = ''): DataNode[] => {
      const result: DataNode[] = [];

      // Sort and add branches
      const sortedBranches = [...node.branches].sort((a, b) => {
        const aName = isRemote ? a.name.replace('remotes/', '') : a.name;
        const bName = isRemote ? b.name.replace('remotes/', '') : b.name;
        return aName.localeCompare(bName);
      });

      sortedBranches.forEach(branch => {
        const displayName = isRemote 
          ? branch.name.replace('remotes/', '').split('/').pop()!
          : branch.name.split('/').pop()!;
        result.push(createBranchNode(branch, displayName));
      });

      // Sort and add folders
      const sortedFolders = Array.from(node.folders.entries()).sort((a, b) => 
        a[0].localeCompare(b[0])
      );

      sortedFolders.forEach(([folderName, folderNode]) => {
        const folderKey = `${pathPrefix}${folderName}/`;
        const children = convertNode(folderNode, folderKey);
        
        if (children.length > 0) {
          result.push({
            title: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{folderName}</span>,
            key: folderKey,
            icon: <BranchesOutlined style={{ color: 'var(--text-secondary)' }} />,
            children,
            selectable: false,
          });
        }
      });

      return result;
    };

    return convertNode(root);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px' 
      }}>
        <Spin size="large" tip="Loading branches..." />
      </div>
    );
  }

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

  // Filter branches based on search text
  const filterBranches = (branchList: BranchInfo[]) => {
    if (!filterText.trim()) return branchList;
    const query = filterText.toLowerCase();
    return branchList.filter(b => 
      b.name.toLowerCase().includes(query) ||
      b.author?.toLowerCase().includes(query) ||
      b.lastCommitMessage?.toLowerCase().includes(query)
    );
  };

  const filteredLocalBranches = filterBranches(localBranches);
  const filteredRemoteBranches = filterBranches(remoteBranches);

  // Create tree structure with local and remote groups
  const treeData: DataNode[] = [];

  if (filteredLocalBranches.length > 0) {
    treeData.push({
      title: <strong style={{ color: 'var(--text-primary)' }}>Local Branches ({filteredLocalBranches.length})</strong>,
      key: 'local',
      icon: <BranchesOutlined style={{ color: 'var(--text-primary)' }} />,
      children: buildBranchHierarchy(filteredLocalBranches, false),
      selectable: false,
    });
  }

  if (filteredRemoteBranches.length > 0) {
    treeData.push({
      title: <strong style={{ color: 'var(--text-primary)' }}>Remote Branches ({filteredRemoteBranches.length})</strong>,
      key: 'remote',
      icon: <BranchesOutlined style={{ color: 'var(--text-primary)' }} />,
      children: buildBranchHierarchy(filteredRemoteBranches, true),
      selectable: false,
    });
  }

  return (
    <div className="branch-tree-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ 
        marginBottom: 16, 
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
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
        
        <Input
          placeholder="Filter branches..."
          prefix={<SearchOutlined />}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          allowClear
          size="small"
        />
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        {treeData.length > 0 ? (
          <Tree
            showIcon={false}
            defaultExpandAll
            treeData={treeData}
            selectable={false}
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        ) : (
          <Empty 
            description={filterText ? `No branches match "${filterText}"` : "No branches available"} 
            style={{ marginTop: 40 }}
          />
        )}
      </div>
    </div>
  );
};

export default BranchTreePanel;
