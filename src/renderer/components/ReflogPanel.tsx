import React, { useState, useEffect, useMemo } from 'react';
import { Button, Dropdown, Space, Tag, Tooltip, Modal, message, Select, Input, DatePicker, Checkbox, Timeline, Collapse } from 'antd';
import {
  ClockCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  BranchesOutlined,
  MergeCellsOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MoreOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
  PullRequestOutlined,
} from '@ant-design/icons';
import { ReflogEntry } from '../types';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

interface ReflogPanelProps {
  repoPath: string;
  onEntryClick?: (entry: ReflogEntry) => void;
}

const ReflogPanel: React.FC<ReflogPanelProps> = ({ repoPath, onEntryClick }) => {
  const [reflogEntries, setReflogEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string>('HEAD');
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ReflogEntry | null>(null);
  const [resetMode, setResetMode] = useState<'soft' | 'mixed' | 'hard'>('mixed');
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  useEffect(() => {
    loadReflog();
  }, [repoPath, selectedRef]);

  const loadReflog = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const entries = await window.electronAPI.getReflog(repoPath, selectedRef, 100);
      setReflogEntries(entries);
    } catch (error) {
      console.error('Error loading reflog:', error);
      message.error('Failed to load reflog');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToCommit = async (entry: ReflogEntry, mode: 'soft' | 'mixed' | 'hard') => {
    try {
      await window.electronAPI.resetToCommit(repoPath, entry.hash, mode);
      message.success(`Successfully reset to ${entry.hash.substring(0, 7)} (${mode})`);
      loadReflog();
    } catch (error) {
      console.error('Error resetting to commit:', error);
      message.error('Failed to reset to commit');
    }
  };

  const showResetModal = (entry: ReflogEntry) => {
    setSelectedEntry(entry);
    setResetModalVisible(true);
  };

  const handleResetConfirm = () => {
    if (selectedEntry) {
      handleResetToCommit(selectedEntry, resetMode);
      setResetModalVisible(false);
      setSelectedEntry(null);
    }
  };

  const handleCherryPick = async (entry: ReflogEntry) => {
    try {
      await window.electronAPI.cherryPickCommit(repoPath, entry.hash);
      message.success(`Successfully cherry-picked commit ${entry.hash.substring(0, 7)}`);
      loadReflog();
    } catch (error) {
      console.error('Error cherry-picking commit:', error);
      message.error('Failed to cherry-pick commit. Check for conflicts.');
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setSelectedActionTypes([]);
    setDateRange(null);
  };

  const getUniqueActionTypes = (): string[] => {
    const types = new Set<string>();
    reflogEntries.forEach(entry => {
      types.add(entry.action);
    });
    return Array.from(types).sort();
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'commit':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'checkout':
        return <BranchesOutlined style={{ color: '#1890ff' }} />;
      case 'merge':
        return <MergeCellsOutlined style={{ color: '#722ed1' }} />;
      case 'reset':
        return <RollbackOutlined style={{ color: '#fa8c16' }} />;
      case 'rebase':
        return <EditOutlined style={{ color: '#eb2f96' }} />;
      case 'pull':
        return <ReloadOutlined style={{ color: '#13c2c2' }} />;
      case 'amend':
        return <EditOutlined style={{ color: '#faad14' }} />;
      case 'fetch':
        return <ReloadOutlined style={{ color: '#2db7f5' }} />;
      case 'clone':
        return <PullRequestOutlined style={{ color: '#87d068' }} />;
      case 'cherry-pick':
        return <PullRequestOutlined style={{ color: '#f759ab' }} />;
      case 'initial':
        return <CheckCircleOutlined style={{ color: '#096dd9' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'commit':
        return 'success';
      case 'checkout':
        return 'processing';
      case 'merge':
        return 'purple';
      case 'reset':
        return 'warning';
      case 'rebase':
        return 'magenta';
      case 'pull':
        return 'cyan';
      case 'amend':
        return 'gold';
      case 'fetch':
        return 'blue';
      case 'clone':
        return 'green';
      case 'cherry-pick':
        return 'pink';
      case 'initial':
        return 'geekblue';
      default:
        return 'default';
    }
  };

  const getTimelineColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'commit':
        return '#52c41a';
      case 'checkout':
        return '#1890ff';
      case 'merge':
        return '#722ed1';
      case 'reset':
        return '#fa8c16';
      case 'rebase':
        return '#eb2f96';
      case 'pull':
        return '#13c2c2';
      case 'amend':
        return '#faad14';
      case 'fetch':
        return '#2db7f5';
      case 'clone':
        return '#87d068';
      case 'cherry-pick':
        return '#f759ab';
      case 'initial':
        return '#096dd9';
      default:
        return '#8c8c8c';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getMenuItems = (entry: ReflogEntry) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View Commit Details',
      onClick: () => {
        if (onEntryClick) {
          onEntryClick(entry);
        }
      },
    },
    {
      key: 'cherry-pick',
      icon: <PullRequestOutlined />,
      label: 'Cherry-pick Commit',
      onClick: () => handleCherryPick(entry),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'reset-soft',
      icon: <RollbackOutlined />,
      label: 'Reset (Soft)',
      onClick: () => handleResetToCommit(entry, 'soft'),
    },
    {
      key: 'reset-mixed',
      icon: <RollbackOutlined />,
      label: 'Reset (Mixed)',
      onClick: () => handleResetToCommit(entry, 'mixed'),
    },
    {
      key: 'reset-hard',
      icon: <RollbackOutlined />,
      label: 'Reset (Hard)',
      danger: true,
      onClick: () => showResetModal(entry),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'copy-hash',
      label: 'Copy Commit Hash',
      onClick: () => {
        navigator.clipboard.writeText(entry.hash);
        message.success('Commit hash copied to clipboard');
      },
    },
  ];

  // Filter entries based on search, action types, and date range
  const filteredEntries = useMemo(() => {
    return reflogEntries.filter(entry => {
      // Search filter
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchesSearch = 
          entry.hash.toLowerCase().includes(search) ||
          entry.message.toLowerCase().includes(search) ||
          entry.author.toLowerCase().includes(search) ||
          entry.selector.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Action type filter
      if (selectedActionTypes.length > 0) {
        if (!selectedActionTypes.includes(entry.action)) return false;
      }

      // Date range filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const entryDate = dayjs(entry.date);
        if (!entryDate.isBetween(dateRange[0], dateRange[1], 'day', '[]')) {
          return false;
        }
      }

      return true;
    });
  }, [reflogEntries, searchText, selectedActionTypes, dateRange]);

  return (
    <div className="reflog-panel">
      <div className="reflog-panel-header">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space wrap>
            <Select
              value={selectedRef}
              onChange={setSelectedRef}
              style={{ minWidth: 150 }}
              size="small"
            >
              <Option value="HEAD">HEAD</Option>
              <Option value="HEAD@{upstream}">Upstream</Option>
              <Option value="--all">All Refs</Option>
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadReflog}
              loading={loading}
              size="small"
            >
              Refresh
            </Button>
          </Space>

          <Collapse ghost size="small">
            <Panel 
              header={
                <Space>
                  <FilterOutlined />
                  <span>Filters & Search</span>
                  {(searchText || selectedActionTypes.length > 0 || dateRange) && (
                    <Tag color="blue">Active</Tag>
                  )}
                </Space>
              } 
              key="filters"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Input
                  placeholder="Search by hash, message, author, or selector..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  size="small"
                />
                
                <div>
                  <div className="reflog-filter-label">Action Types:</div>
                  <Checkbox.Group
                    value={selectedActionTypes}
                    onChange={setSelectedActionTypes}
                    style={{ width: '100%' }}
                  >
                    <Space wrap>
                      {getUniqueActionTypes().map(type => (
                        <Checkbox key={type} value={type}>
                          <Space size={4}>
                            {getActionIcon(type)}
                            <Tag color={getActionColor(type)} style={{ margin: 0 }}>
                              {type.toUpperCase()}
                            </Tag>
                          </Space>
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                </div>

                <div>
                  <div className="reflog-filter-label">Date Range:</div>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    style={{ width: '100%' }}
                    size="small"
                    format="YYYY-MM-DD"
                  />
                </div>

                <Space>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={clearFilters}
                    size="small"
                    disabled={!searchText && selectedActionTypes.length === 0 && !dateRange}
                  >
                    Clear Filters
                  </Button>
                  <div className="reflog-entry-count">
                    Showing {filteredEntries.length} of {reflogEntries.length} entries
                  </div>
                </Space>
              </Space>
            </Panel>
          </Collapse>
        </Space>
      </div>

      <div className="reflog-panel-content">
        {filteredEntries.length === 0 ? (
          <div className="reflog-empty">
            <ClockCircleOutlined className="reflog-empty-icon" />
            <p>{reflogEntries.length === 0 ? 'No reflog entries found' : 'No entries match the current filters'}</p>
            {reflogEntries.length > 0 && (
              <Button onClick={clearFilters} size="small">Clear Filters</Button>
            )}
          </div>
        ) : (
          <Timeline
            mode="left"
            className="reflog-timeline"
            items={filteredEntries.map((entry, index) => ({
              color: getTimelineColor(entry.action),
              dot: getActionIcon(entry.action),
              label: formatDate(entry.date),
              children: (
                <div 
                  className="timeline-entry" 
                  onClick={() => onEntryClick && onEntryClick(entry)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="timeline-entry-header">
                    <Space size="small">
                      <Tag color={getActionColor(entry.action)}>{entry.action.toUpperCase()}</Tag>
                      <span className="reflog-hash">{entry.hash.substring(0, 7)}</span>
                      <span className="reflog-selector">{entry.selector}</span>
                    </Space>
                    <Dropdown menu={{ items: getMenuItems(entry) }} trigger={['click']}>
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      />
                    </Dropdown>
                  </div>
                  <div className="timeline-entry-message">{entry.message}</div>
                  <div className="timeline-entry-author">{entry.author}</div>
                </div>
              ),
            }))}
          />
        )}
      </div>

      <Modal
        title="Confirm Hard Reset"
        open={resetModalVisible}
        onOk={handleResetConfirm}
        onCancel={() => {
          setResetModalVisible(false);
          setSelectedEntry(null);
        }}
        okText="Reset"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16 }}>
          <p><strong>Warning:</strong> Hard reset will discard all uncommitted changes.</p>
          {selectedEntry && (
            <div>
              <p>Reset to commit: <code>{selectedEntry.hash.substring(0, 7)}</code></p>
              <p>Message: {selectedEntry.message}</p>
            </div>
          )}
        </div>
        <div>
          <p>Select reset mode:</p>
          <Select
            value={resetMode}
            onChange={setResetMode}
            style={{ width: '100%' }}
          >
            <Option value="soft">
              <strong>Soft:</strong> Keep changes staged
            </Option>
            <Option value="mixed">
              <strong>Mixed:</strong> Keep changes unstaged
            </Option>
            <Option value="hard">
              <strong>Hard:</strong> Discard all changes
            </Option>
          </Select>
        </div>
      </Modal>

      <style>{`
        .reflog-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
        }

        .reflog-panel-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .reflog-count {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .reflog-panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .reflog-tree .ant-tree-treenode {
          padding: 4px 0;
        }

        .reflog-entry {
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          margin: 4px 0;
          width: 100%;
        }

        .reflog-entry:hover {
          background: var(--bg-hover);
          border-color: var(--primary-color);
        }

        .reflog-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .reflog-hash {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 12px;
          color: var(--text-secondary);
          background: var(--bg-code);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .reflog-selector {
          font-size: 11px;
          color: var(--text-tertiary);
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .reflog-entry-message {
          font-size: 13px;
          color: var(--text-primary);
          margin: 6px 0;
          line-height: 1.5;
          word-wrap: break-word;
          word-break: break-word;
        }

        .reflog-entry-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: var(--text-tertiary);
          margin-top: 6px;
        }

        .reflog-author {
          font-weight: 500;
        }

        .reflog-date {
          font-style: italic;
        }

        .reflog-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
        }

        .reflog-empty-icon {
          font-size: 48px;
          color: var(--text-tertiary);
        }

        .reflog-filter-label {
          margin-bottom: 4px;
          font-size: 12px;
          color: var(--text-tertiary);
        }

        .reflog-entry-count {
          font-size: 12px;
          color: var(--text-tertiary);
        }

        .reflog-empty p {
          margin-top: 16px;
          font-size: 14px;
        }

        /* Timeline styles */
        .reflog-timeline {
          padding: 16px;
          display: flex;
          justify-content: center;
        }

        .reflog-timeline .ant-timeline {
          max-width: 800px;
          width: 100%;
        }

        .timeline-entry {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          transition: all 0.2s;
          width: 100%;
          max-width: 600px;
          box-sizing: border-box;
        }

        .timeline-entry:hover {
          background: var(--bg-hover);
          border-color: var(--primary-color);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .timeline-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .timeline-entry-message {
          font-size: 13px;
          color: var(--text-primary);
          margin: 6px 0;
          word-wrap: break-word;
          word-break: break-word;
        }

        .timeline-entry-author {
          font-size: 11px;
          color: var(--text-tertiary);
          font-weight: 500;
        }

        /* Dark theme support */
        body.dark-theme .reflog-panel {
          --bg-primary: #1f1f1f;
          --bg-secondary: #121212;
          --bg-hover: #2a2a2a;
          --bg-code: #2a2a2a;
          --border-color: #3a3a3a;
          --text-primary: #e0e0e0;
          --text-secondary: #a0a0a0;
          --text-tertiary: #707070;
          --primary-color: #4a9eff;
        }

        body.dark-theme .reflog-entry,
        body.dark-theme .timeline-entry {
          background: #1f1f1f;
          border-color: #3a3a3a;
        }

        body.dark-theme .reflog-entry:hover,
        body.dark-theme .timeline-entry:hover {
          background: #2a2a2a;
          border-color: #4a9eff;
        }

        body.dark-theme .reflog-hash {
          background: #2a2a2a;
          color: #a0a0a0;
        }

        body.dark-theme .reflog-panel-header {
          background: #121212;
          border-bottom-color: #3a3a3a;
        }

        body.dark-theme .ant-timeline-item-label {
          color: #a0a0a0 !important;
        }

        body.dark-theme .ant-timeline-item-tail {
          background-color: #3a3a3a !important;
        }

        body.dark-theme .ant-timeline-item-head {
          background-color: transparent !important;
        }

        body.dark-theme .ant-timeline .anticon {
          color: inherit !important;
          background: transparent !important;
        }

        body.dark-theme .ant-timeline-item-head-custom {
          background: transparent !important;
        }

        /* Light theme */
        .reflog-panel {
          --bg-primary: #ffffff;
          --bg-secondary: #fafafa;
          --bg-hover: #f5f5f5;
          --bg-code: #f5f5f5;
          --border-color: #d9d9d9;
          --text-primary: #000000;
          --text-secondary: #595959;
          --text-tertiary: #8c8c8c;
          --primary-color: #1890ff;
        }
      `}</style>
    </div>
  );
};

export default ReflogPanel;
