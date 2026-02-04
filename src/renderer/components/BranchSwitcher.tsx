import React, { useState, useEffect } from 'react';
import { Modal, List, Input, Spin, message, Button, Alert, Space, Tag } from 'antd';
import { 
  BranchesOutlined, 
  SearchOutlined, 
  ClockCircleOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { BranchInfo } from '../types';
import { useTheme } from '../ThemeContext';

interface BranchSwitcherProps {
  visible: boolean;
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onBranchSwitch: (branchName: string) => void;
  onStashAndSwitch?: (branchName: string) => void;
  onDiscardAndSwitch?: (branchName: string) => void;
}

interface CheckoutError {
  hasUncommittedChanges: boolean;
  modifiedFiles: string[];
  message: string;
}

const BranchSwitcher: React.FC<BranchSwitcherProps> = ({
  visible,
  repoPath,
  currentBranch,
  onClose,
  onBranchSwitch,
  onStashAndSwitch,
  onDiscardAndSwitch,
}) => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (visible && repoPath) {
      loadBranches();
    }
    // Clear error when modal opens
    setCheckoutError(null);
    setSelectedBranch(null);
  }, [visible, repoPath]);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const branchData = await window.electronAPI.getBranches(repoPath);
      
      // Sort branches by last commit date (most recent first)
      const sortedBranches = branchData.sort((a, b) => {
        const dateA = new Date(a.lastCommitDate).getTime();
        const dateB = new Date(b.lastCommitDate).getTime();
        return dateB - dateA;
      });
      
      setBranches(sortedBranches);
    } catch (error) {
      console.error('Error loading branches:', error);
      message.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchClick = async (branchName: string) => {
    if (branchName === currentBranch) {
      message.info('Already on this branch');
      return;
    }

    setSelectedBranch(branchName);
    setSwitching(true);
    setCheckoutError(null);

    try {
      await onBranchSwitch(branchName);
      message.success(`Switched to branch: ${branchName}`);
      onClose();
    } catch (error: any) {
      // Check if error is due to uncommitted changes
      if (error?.hasUncommittedChanges) {
        setCheckoutError(error);
      } else {
        message.error(error?.message || 'Failed to switch branch');
        setSelectedBranch(null);
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleStashAndSwitch = async () => {
    if (!selectedBranch || !onStashAndSwitch) return;

    setSwitching(true);
    try {
      await onStashAndSwitch(selectedBranch);
      message.success(`Stashed changes and switched to: ${selectedBranch}`);
      setCheckoutError(null);
      setSelectedBranch(null);
      onClose();
    } catch (error: any) {
      message.error(error?.message || 'Failed to stash and switch');
    } finally {
      setSwitching(false);
    }
  };

  const handleDiscardAndSwitch = async () => {
    if (!selectedBranch || !onDiscardAndSwitch) return;

    setSwitching(true);
    try {
      await onDiscardAndSwitch(selectedBranch);
      message.success(`Discarded changes and switched to: ${selectedBranch}`);
      setCheckoutError(null);
      setSelectedBranch(null);
      onClose();
    } catch (error: any) {
      message.error(error?.message || 'Failed to discard and switch');
    } finally {
      setSwitching(false);
    }
  };

  const handleCancelSwitch = () => {
    setCheckoutError(null);
    setSelectedBranch(null);
  };

  // Filter branches based on search query
  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.lastCommitMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
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

  const getBranchType = (branchName: string) => {
    if (branchName.startsWith('remotes/')) return 'remote';
    return 'local';
  };

  return (
    <Modal
      title="Switch Branch"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      style={{ top: 20 }}
    >
      {checkoutError ? (
        <div>
          <Alert
            message="Cannot Switch Branch"
            description={
              <div>
                <p>{checkoutError.message}</p>
                <p style={{ marginTop: 8, fontWeight: 'bold' }}>
                  Modified files ({checkoutError.modifiedFiles.length}):
                </p>
                <ul style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12 }}>
                  {checkoutError.modifiedFiles.slice(0, 20).map((file, idx) => (
                    <li key={idx}>{file}</li>
                  ))}
                  {checkoutError.modifiedFiles.length > 20 && (
                    <li>... and {checkoutError.modifiedFiles.length - 20} more files</li>
                  )}
                </ul>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 'bold', marginBottom: 8 }}>What would you like to do?</p>
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {onStashAndSwitch && (
              <Button
                block
                size="large"
                icon={<SaveOutlined />}
                onClick={handleStashAndSwitch}
                loading={switching}
                type="primary"
              >
                Stash Changes & Switch
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  Save your changes for later and switch to <strong>{selectedBranch}</strong>
                </div>
              </Button>
            )}

            {onDiscardAndSwitch && (
              <Button
                block
                size="large"
                icon={<DeleteOutlined />}
                onClick={handleDiscardAndSwitch}
                loading={switching}
                danger
              >
                Discard Changes & Switch
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  Permanently discard all changes and switch to <strong>{selectedBranch}</strong>
                </div>
              </Button>
            )}

            <Button block onClick={handleCancelSwitch}>
              Cancel
            </Button>
          </Space>
        </div>
      ) : (
        <>
          <Input
            placeholder="Search branches..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 16 }}
            allowClear
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin tip="Loading branches..." />
            </div>
          ) : (
            <List
              dataSource={filteredBranches}
              style={{ maxHeight: 500, overflowY: 'auto' }}
              renderItem={(branch) => {
                const isCurrentBranch = branch.name === currentBranch;
                const branchType = getBranchType(branch.name);
                const displayName = branch.name.replace('remotes/', '');

                return (
                  <List.Item
                    key={branch.name}
                    onClick={() => !isCurrentBranch && !switching && handleBranchClick(branch.name)}
                    style={{
                      cursor: isCurrentBranch ? 'default' : 'pointer',
                      backgroundColor: isCurrentBranch 
                        ? (isDarkMode ? 'rgba(24, 144, 255, 0.15)' : '#f0f7ff')
                        : 'transparent',
                      padding: '12px 16px',
                      borderRadius: 4,
                      marginBottom: 4,
                      opacity: switching && selectedBranch !== branch.name ? 0.5 : 1,
                    }}
                    className={!isCurrentBranch ? 'branch-item-hover' : ''}
                  >
                    <List.Item.Meta
                      avatar={
                        isCurrentBranch ? (
                          <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                        ) : (
                          <BranchesOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                        )
                      }
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: isCurrentBranch ? 'bold' : 'normal' }}>
                            {displayName}
                          </span>
                          {isCurrentBranch && (
                            <Tag color="green" style={{ margin: 0 }}>
                              Current
                            </Tag>
                          )}
                          {branchType === 'remote' && (
                            <Tag color="orange" style={{ margin: 0 }}>
                              Remote
                            </Tag>
                          )}
                        </div>
                      }
                      description={
                        <div style={{ fontSize: 12 }}>
                          {branch.lastCommitMessage && (
                            <div
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginBottom: 4,
                              }}
                            >
                              {branch.lastCommitMessage}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 12, color: '#999' }}>
                            {branch.lastCommitDate && (
                              <span>
                                <ClockCircleOutlined /> {formatDate(branch.lastCommitDate)}
                              </span>
                            )}
                            {branch.author && <span>{branch.author}</span>}
                          </div>
                        </div>
                      }
                    />
                    {switching && selectedBranch === branch.name && <Spin size="small" />}
                  </List.Item>
                );
              }}
            />
          )}

          {!loading && filteredBranches.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <BranchesOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <p>No branches found</p>
            </div>
          )}
        </>
      )}

      <style>{`
        .branch-item-hover:hover {
          background-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5'};
        }
      `}</style>
    </Modal>
  );
};

export default BranchSwitcher;
