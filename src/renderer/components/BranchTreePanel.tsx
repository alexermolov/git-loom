import React, { useState } from 'react';
import { Empty, Tree, Dropdown, Modal, Spin, Input, Form, Select, message, Radio, Space, App } from 'antd';
import type { MenuProps } from 'antd';
import { BranchesOutlined, CheckCircleOutlined, ClockCircleOutlined, MergeCellsOutlined, SwapOutlined, SearchOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LinkOutlined, DisconnectOutlined, DiffOutlined } from '@ant-design/icons';
import { BranchInfo } from '../types';
import type { DataNode } from 'antd/es/tree';

interface BranchTreePanelProps {
  repoPath: string;
  branches: BranchInfo[];
  currentBranch: string;
  onCheckoutBranch?: (branchName: string) => void;
  onMergeBranch?: (branchName: string, mergeMode?: 'auto' | 'no-ff' | 'ff-only') => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const BranchTreePanel: React.FC<BranchTreePanelProps> = ({ repoPath, branches, currentBranch, onCheckoutBranch, onMergeBranch, onRefresh, loading = false }) => {
  const { modal } = App.useApp();
  const [filterText, setFilterText] = useState('');

  // Handle create new branch
  const handleCreateBranch = (fromCommit?: string) => {
    modal.confirm({
      title: 'Create New Branch',
      content: (
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Branch Name" required>
            <Input id="new-branch-name" placeholder="feature/my-new-feature" />
          </Form.Item>
          {fromCommit && (
            <Form.Item label="Starting Point">
              <Input value={fromCommit} disabled />
            </Form.Item>
          )}
          <Form.Item>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                id="switch-after-create-checkbox" 
                defaultChecked={true}
                style={{ marginRight: 8 }} 
              />
              Switch to new branch after creation
            </label>
          </Form.Item>
          <Form.Item>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                id="push-after-create-checkbox" 
                style={{ marginRight: 8 }} 
              />
              Push new branch to remote (origin)
            </label>
          </Form.Item>
        </Form>
      ),
      okText: 'Create',
      cancelText: 'Cancel',
      onOk: async () => {
        const input = document.getElementById('new-branch-name') as HTMLInputElement;
        const switchCheckbox = document.getElementById('switch-after-create-checkbox') as HTMLInputElement;
        const pushCheckbox = document.getElementById('push-after-create-checkbox') as HTMLInputElement;
        
        const branchName = input?.value.trim();
        const switchAfterCreate = switchCheckbox?.checked || false;
        const pushAfterCreate = pushCheckbox?.checked || false;
        
        if (!branchName) {
          message.error('Branch name is required');
          return Promise.reject();
        }

        try {
          await window.electronAPI.createBranch(repoPath, branchName, fromCommit, switchAfterCreate, pushAfterCreate);
          
          let successMessage = `Branch "${branchName}" created successfully`;
          if (switchAfterCreate) {
            successMessage += ' and checked out';
          }
          if (pushAfterCreate) {
            successMessage += ', pushed to remote';
          }
          
          message.success(successMessage);
          onRefresh?.();
        } catch (error: any) {
          message.error(error.message || 'Failed to create branch');
          throw error;
        }
      },
    });
  };

  // Handle delete branch
  const handleDeleteBranch = (branchName: string, isRemote: boolean) => {
    const displayName = isRemote ? branchName.replace('remotes/', '') : branchName;
    
    modal.confirm({
      title: `Delete ${isRemote ? 'Remote' : 'Local'} Branch`,
      content: `Are you sure you want to delete branch "${displayName}"? This action cannot be undone.`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          if (isRemote) {
            const parts = branchName.replace('remotes/', '').split('/');
            const remoteName = parts[0];
            const remoteBranchName = parts.slice(1).join('/');
            await window.electronAPI.deleteRemoteBranch(repoPath, remoteName, remoteBranchName);
            message.success(`Remote branch "${displayName}" deleted successfully`);
          } else {
            const result = await window.electronAPI.deleteBranch(repoPath, branchName, false);
            if (result.success) {
              message.success(`Branch "${branchName}" deleted successfully`);
            } else if (result.warning) {
              // Branch is not merged, ask for force delete
              modal.confirm({
                title: 'Branch Not Merged',
                content: result.warning + ' Do you want to force delete?',
                okText: 'Force Delete',
                okButtonProps: { danger: true },
                cancelText: 'Cancel',
                onOk: async () => {
                  try {
                    await window.electronAPI.deleteBranch(repoPath, branchName, true);
                    message.success(`Branch "${branchName}" force deleted successfully`);
                    onRefresh?.();
                  } catch (error: any) {
                    message.error(error.message || 'Failed to delete branch');
                  }
                },
              });
              return;
            }
          }
          onRefresh?.();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete branch');
        }
      },
    });
  };

  // Handle rename branch
  const handleRenameBranch = (branchName: string) => {
    modal.confirm({
      title: 'Rename Branch',
      content: (
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Current Name">
            <Input value={branchName} disabled />
          </Form.Item>
          <Form.Item label="New Name" required>
            <Input id="new-branch-name-rename" placeholder="feature/new-name" />
          </Form.Item>
          <Form.Item>
            <label>
              <input type="checkbox" id="rename-remote-checkbox" style={{ marginRight: 8 }} />
              Also rename on remote (if tracking)
            </label>
          </Form.Item>
        </Form>
      ),
      okText: 'Rename',
      cancelText: 'Cancel',
      onOk: async () => {
        const input = document.getElementById('new-branch-name-rename') as HTMLInputElement;
        const checkbox = document.getElementById('rename-remote-checkbox') as HTMLInputElement;
        const newName = input?.value.trim();
        const renameRemote = checkbox?.checked || false;
        
        if (!newName) {
          message.error('New branch name is required');
          return Promise.reject();
        }

        try {
          await window.electronAPI.renameBranch(repoPath, branchName, newName, renameRemote);
          message.success(`Branch renamed from "${branchName}" to "${newName}"`);
          onRefresh?.();
        } catch (error: any) {
          message.error(error.message || 'Failed to rename branch');
          throw error;
        }
      },
    });
  };

  // Handle set upstream
  const handleSetUpstream = (branchName: string, remoteBranches: BranchInfo[]) => {
    const remoteOptions = Array.from(
      new Set(remoteBranches.map(b => b.name.replace('remotes/', '').split('/')[0]))
    );

    let selectedRemote = remoteOptions[0] || 'origin';
    let selectedBranch = branchName;

    modal.confirm({
      title: 'Set Upstream Branch',
      content: (
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Local Branch">
            <Input value={branchName} disabled />
          </Form.Item>
          <Form.Item label="Remote" required>
            <Select 
              id="upstream-remote-select" 
              defaultValue={selectedRemote}
              options={remoteOptions.map(r => ({ label: r, value: r }))}
            />
          </Form.Item>
          <Form.Item label="Remote Branch" required>
            <Input id="upstream-branch-input" defaultValue={selectedBranch} placeholder="main" />
          </Form.Item>
        </Form>
      ),
      okText: 'Set Upstream',
      cancelText: 'Cancel',
      onOk: async () => {
        const remoteSelect = document.getElementById('upstream-remote-select') as any;
        const branchInput = document.getElementById('upstream-branch-input') as HTMLInputElement;
        
        const remote = remoteSelect?.innerText || selectedRemote;
        const remoteBranchName = branchInput?.value.trim() || selectedBranch;

        try {
          await window.electronAPI.setUpstreamBranch(repoPath, branchName, remote, remoteBranchName);
          message.success(`Upstream set to ${remote}/${remoteBranchName}`);
          onRefresh?.();
        } catch (error: any) {
          message.error(error.message || 'Failed to set upstream');
          throw error;
        }
      },
    });
  };

  // Handle unset upstream
  const handleUnsetUpstream = (branchName: string) => {
    modal.confirm({
      title: 'Unset Upstream Branch',
      content: `Remove upstream tracking for branch "${branchName}"?`,
      okText: 'Unset',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await window.electronAPI.unsetUpstreamBranch(repoPath, branchName);
          message.success(`Upstream unset for branch "${branchName}"`);
          onRefresh?.();
        } catch (error: any) {
          message.error(error.message || 'Failed to unset upstream');
        }
      },
    });
  };

  // Handle compare branches
  const handleCompareBranches = (branchName: string) => {
    Modal.info({
      title: `Compare with "${branchName}"`,
      content: (
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Base Branch">
            <Input value={currentBranch} disabled />
          </Form.Item>
          <Form.Item label="Compare Branch">
            <Input value={branchName} disabled />
          </Form.Item>
        </Form>
      ),
      okText: 'Compare',
      onOk: async () => {
        try {
          const comparison = await window.electronAPI.compareBranches(repoPath, currentBranch, branchName);
          
          Modal.info({
            title: 'Branch Comparison',
            width: 600,
            content: (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <strong>Commits Ahead:</strong> {comparison.ahead}<br />
                  <strong>Commits Behind:</strong> {comparison.behind}
                </div>
                <div>
                  <strong>Changed Files ({comparison.files.length}):</strong>
                  <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
                    {comparison.files.map((file: any) => (
                      <div key={file.path} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{file.path}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--success-color)' }}>+{file.additions}</span>
                          {' '}
                          <span style={{ color: 'var(--error-color)' }}>-{file.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          });
        } catch (error: any) {
          message.error(error.message || 'Failed to compare branches');
        }
      },
    });
  };

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
      
      modal.confirm({
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
      
      let selectedMode: 'auto' | 'no-ff' | 'ff-only' = 'no-ff';
      
      modal.confirm({
        title: 'Merge Branch',
        content: (
          <div>
            <p>Merge branch <strong>{displayName}</strong> into current branch <strong>{currentBranch}</strong></p>
            <Form layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item label="Merge Mode">
                <Radio.Group 
                  defaultValue="no-ff" 
                  onChange={(e) => selectedMode = e.target.value}
                >
                  <Space direction="vertical">
                    <Radio value="no-ff">
                      <strong>Create merge commit (--no-ff)</strong>
                      <div style={{ fontSize: 12, color: '#666', marginLeft: 24 }}>Always create a merge commit, even if fast-forward is possible</div>
                    </Radio>
                    <Radio value="auto">
                      <strong>Auto (default Git behavior)</strong>
                      <div style={{ fontSize: 12, color: '#666', marginLeft: 24 }}>Fast-forward if possible, otherwise create merge commit</div>
                    </Radio>
                    <Radio value="ff-only">
                      <strong>Fast-forward only (--ff-only)</strong>
                      <div style={{ fontSize: 12, color: '#666', marginLeft: 24 }}>Only merge if fast-forward is possible, fail otherwise</div>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
            </Form>
          </div>
        ),
        okText: 'Merge',
        cancelText: 'Cancel',
        width: 600,
        onOk: () => {
          onMergeBranch?.(branchName, selectedMode);
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
    
    const menuItems: MenuProps['items'] = [
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
      { type: 'divider' },
    ];

    if (!isRemote) {
      // Local branch actions
      menuItems.push(
        {
          key: 'rename',
          label: 'Rename Branch',
          icon: <EditOutlined />,
          onClick: () => handleRenameBranch(branch.name),
        },
        {
          key: 'delete',
          label: 'Delete Branch',
          icon: <DeleteOutlined />,
          danger: true,
          disabled: isCurrent,
          onClick: () => handleDeleteBranch(branch.name, false),
        },
        { type: 'divider' },
        {
          key: 'set-upstream',
          label: 'Set Upstream',
          icon: <LinkOutlined />,
          onClick: () => handleSetUpstream(branch.name, branches.filter(b => b.name.startsWith('remotes/'))),
        },
        {
          key: 'unset-upstream',
          label: 'Unset Upstream',
          icon: <DisconnectOutlined />,
          onClick: () => handleUnsetUpstream(branch.name),
        }
      );
    } else {
      // Remote branch actions
      menuItems.push(
        {
          key: 'delete-remote',
          label: 'Delete Remote Branch',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDeleteBranch(branch.name, true),
        }
      );
    }

    menuItems.push(
      { type: 'divider' },
      {
        key: 'compare',
        label: 'Compare with Current',
        icon: <DiffOutlined />,
        disabled: isCurrent,
        onClick: () => handleCompareBranches(branch.name),
      }
    );

    return { items: menuItems };
  };

  const createBranchNode = (branch: BranchInfo, displayName: string): DataNode => {
    const isCurrent = branch.name === currentBranch;
    const isRemote = branch.name.startsWith('remotes/');
    
    // Create title with status icons
    const title = (
      <Dropdown menu={getContextMenu(branch)} trigger={['contextMenu']}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'context-menu' }}>
          <BranchesOutlined style={{ color: isCurrent ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
          {isCurrent && <CheckCircleOutlined style={{ color: 'var(--success-color)' }} />}
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
          justifyContent: 'space-between',
          color: 'var(--text-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BranchesOutlined />
            Git Branches
          </div>
          <button
            onClick={() => handleCreateBranch()}
            className="new-branch-btn"
            title="Create new branch"
          >
            <PlusOutlined />
            New Branch
          </button>
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
