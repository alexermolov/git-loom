import React, { useState, useEffect } from 'react';
import {
  Button,
  Spin,
  Empty,
  Tooltip,
  message,
  Timeline,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Divider,
  Modal,
  Select,
  Table,
  Space,
  Descriptions,
  Badge,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  DiffOutlined,
  RollbackOutlined,
  BarChartOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  SwapOutlined,
  HistoryOutlined,
  LineChartOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useTheme } from '../ThemeContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type {
  FileHistoryTimeline,
  FileHistoryEntry,
  FileComparisonResult,
  FileVersionContent,
  FileStatistics,
  AuthorContribution,
} from '../types';

interface FileHistoryPanelProps {
  repoPath: string;
  filePath: string;
  onBack: () => void;
  backLabel?: string;
  onCommitClick?: (commitHash: string) => void;
}

type ViewMode = 'timeline' | 'statistics' | 'compare' | 'version';

const FileHistoryPanel: React.FC<FileHistoryPanelProps> = ({
  repoPath,
  filePath,
  onBack,
  backLabel = 'Back',
  onCommitClick,
}) => {
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<FileHistoryTimeline | null>(null);
  const [statistics, setStatistics] = useState<FileStatistics | null>(null);
  const [comparison, setComparison] = useState<FileComparisonResult | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<FileVersionContent | null>(null);
  const [selectedFromCommit, setSelectedFromCommit] = useState<string>('');
  const [selectedToCommit, setSelectedToCommit] = useState<string>('');
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedRestoreCommit, setSelectedRestoreCommit] = useState<string>('');

  useEffect(() => {
    setViewMode('timeline');
    setTimeline(null);
    setStatistics(null);
    setComparison(null);
    setSelectedVersion(null);
    setSelectedFromCommit('');
    setSelectedToCommit('');
    setCompareModalVisible(false);
    setVersionModalVisible(false);
    setRestoreModalVisible(false);
    setSelectedRestoreCommit('');
    loadFileHistory();
  }, [repoPath, filePath]);

  useEffect(() => {
    if (viewMode === 'statistics' && !statistics) {
      loadStatistics();
    }
  }, [viewMode]);

  const loadFileHistory = async () => {
    setLoading(true);
    try {
      const history = await window.electronAPI.getFileHistory(repoPath, filePath, 100);
      setTimeline(history);
    } catch (error) {
      console.error('Error loading file history:', error);
      message.error('Failed to load file history');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const stats = await window.electronAPI.getFileStatistics(repoPath, filePath);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading file statistics:', error);
      message.error('Failed to load file statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async (fromHash: string, toHash: string) => {
    setLoading(true);
    try {
      const result = await window.electronAPI.compareFileAcrossCommits(
        repoPath,
        filePath,
        fromHash,
        toHash
      );
      setComparison(result);
      setViewMode('compare');
    } catch (error) {
      console.error('Error comparing files:', error);
      message.error('Failed to compare files');
    } finally {
      setLoading(false);
    }
  };

  const handleViewVersion = async (commitHash: string) => {
    setLoading(true);
    try {
      const version = await window.electronAPI.getFileAtCommit(
        repoPath,
        filePath,
        commitHash
      );
      setSelectedVersion(version);
      setVersionModalVisible(true);
    } catch (error) {
      console.error('Error loading file version:', error);
      message.error('Failed to load file version');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (commitHash: string) => {
    try {
      await window.electronAPI.restoreFileFromCommit(repoPath, filePath, commitHash);
      message.success('File restored successfully');
      setRestoreModalVisible(false);
    } catch (error) {
      console.error('Error restoring file:', error);
      message.error('Failed to restore file');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'green';
      case 'modified':
        return 'blue';
      case 'deleted':
        return 'red';
      case 'renamed':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <PlusOutlined />;
      case 'modified':
        return <EditOutlined />;
      case 'deleted':
        return <MinusOutlined />;
      case 'renamed':
        return <SwapOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const renderTimeline = () => {
    if (!timeline) return null;

    return (
      <div style={{ padding: '20px' }}>
        <Card
          title={
            <Space>
              <HistoryOutlined />
              <span>File Timeline</span>
            </Space>
          }
          extra={
            <Space>
              <Button
                type="primary"
                icon={<DiffOutlined />}
                onClick={() => setCompareModalVisible(true)}
                disabled={!timeline.history.length}
              >
                Compare Versions
              </Button>
              <Button icon={<BarChartOutlined />} onClick={() => setViewMode('statistics')}>
                View Statistics
              </Button>
            </Space>
          }
        >
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <Statistic
                title="Total Commits"
                value={timeline.totalCommits}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="First Commit"
                value={formatDate(timeline.firstCommit?.date || '')}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Last Modified"
                value={formatDate(timeline.lastCommit?.date || '')}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Renames"
                value={timeline.renames.length}
                prefix={<SwapOutlined />}
              />
            </Col>
          </Row>

          {timeline.renames.length > 0 && (
            <Card type="inner" title="File Renames" style={{ marginBottom: 20 }}>
              <Timeline>
                {timeline.renames.map((rename, index) => (
                  <Timeline.Item key={index} color="orange">
                    <div>
                      <Tag color="orange">{formatDate(rename.date)}</Tag>
                      <br />
                      <span style={{ color: '#999' }}>{rename.from}</span>
                      {' → '}
                      <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{rename.to}</span>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          )}

          <Timeline mode="left">
            {timeline.history.map((entry, index) => (
              <Timeline.Item
                key={entry.hash}
                color={getStatusColor(entry.status)}
                label={formatDate(entry.date)}
              >
                <Card
                  size="small"
                  hoverable
                  style={{ cursor: 'pointer' }}
                  bodyStyle={{ padding: '12px' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Tag color={getStatusColor(entry.status)}>
                        {getStatusIcon(entry.status)} {entry.status}
                      </Tag>
                      <Tag color="blue">{entry.shortHash}</Tag>
                      <Tag icon={<UserOutlined />}>{entry.author}</Tag>
                    </Space>
                    <div style={{ fontWeight: 500 }}>{entry.message}</div>
                    <Space>
                      {entry.additions > 0 && (
                        <Tag color="green">+{entry.additions}</Tag>
                      )}
                      {entry.deletions > 0 && (
                        <Tag color="red">-{entry.deletions}</Tag>
                      )}
                    </Space>
                    {entry.oldPath && (
                      <div style={{ fontSize: 12, color: '#999' }}>
                        Renamed from: {entry.oldPath}
                      </div>
                    )}
                    <Space size="small">
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewVersion(entry.hash)}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        icon={<RollbackOutlined />}
                        onClick={() => {
                          setSelectedRestoreCommit(entry.hash);
                          setRestoreModalVisible(true);
                        }}
                      >
                        Restore
                      </Button>
                      {onCommitClick && (
                        <Button
                          size="small"
                          onClick={() => onCommitClick(entry.hash)}
                        >
                          View Commit
                        </Button>
                      )}
                    </Space>
                  </Space>
                </Card>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </div>
    );
  };

  const renderStatistics = () => {
    if (!statistics) return null;

    const authorColumns = [
      {
        title: 'Author',
        dataIndex: 'author',
        key: 'author',
        render: (text: string, record: AuthorContribution) => (
          <Space>
            <UserOutlined />
            <span>{text}</span>
            <span style={{ color: '#999', fontSize: 12 }}>({record.email})</span>
          </Space>
        ),
      },
      {
        title: 'Commits',
        dataIndex: 'commits',
        key: 'commits',
        sorter: (a: AuthorContribution, b: AuthorContribution) => b.commits - a.commits,
      },
      {
        title: 'Additions',
        dataIndex: 'additions',
        key: 'additions',
        render: (val: number) => <Tag color="green">+{val}</Tag>,
      },
      {
        title: 'Deletions',
        dataIndex: 'deletions',
        key: 'deletions',
        render: (val: number) => <Tag color="red">-{val}</Tag>,
      },
      {
        title: 'Contribution',
        dataIndex: 'percentage',
        key: 'percentage',
        render: (val: number) => (
          <Progress percent={val} size="small" style={{ width: 100 }} />
        ),
      },
    ];

    return (
      <div style={{ padding: '20px' }}>
        <Card
          title={
            <Space>
              <BarChartOutlined />
              <span>File Statistics</span>
            </Space>
          }
          extra={
            <Button icon={<HistoryOutlined />} onClick={() => setViewMode('timeline')}>
              Back to Timeline
            </Button>
          }
        >
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Commits"
                  value={statistics.totalCommits}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Authors"
                  value={statistics.totalAuthors}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Additions"
                  value={statistics.totalAdditions}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<PlusOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Deletions"
                  value={statistics.totalDeletions}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<MinusOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={12}>
              <Card>
                <Statistic
                  title="File Age"
                  value={statistics.ageInDays}
                  suffix="days"
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic
                  title="Total Changes"
                  value={statistics.totalChanges}
                  prefix={<LineChartOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Divider>Author Contributions</Divider>

          <Table
            columns={authorColumns}
            dataSource={statistics.authors}
            rowKey="author"
            pagination={{ pageSize: 10 }}
            style={{ marginBottom: 20 }}
          />

          <Divider>Activity by Month</Divider>

          <div style={{ overflowX: 'auto' }}>
            {statistics.activityByMonth.map((activity) => (
              <Card
                key={activity.month}
                size="small"
                style={{ marginBottom: 10 }}
                bodyStyle={{ padding: '10px' }}
              >
                <Row gutter={16} align="middle">
                  <Col span={4}>
                    <strong>{activity.month}</strong>
                  </Col>
                  <Col span={4}>
                    <Tag color="blue">{activity.commits} commits</Tag>
                  </Col>
                  <Col span={8}>
                    <Progress
                      percent={Math.min(
                        100,
                        (activity.commits / statistics.totalCommits) * 100
                      )}
                      size="small"
                      format={(percent) => `${percent?.toFixed(1)}%`}
                    />
                  </Col>
                  <Col span={4}>
                    <Tag color="green">+{activity.additions}</Tag>
                  </Col>
                  <Col span={4}>
                    <Tag color="red">-{activity.deletions}</Tag>
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  const renderComparison = () => {
    if (!comparison) return null;

    return (
      <div style={{ padding: '20px' }}>
        <Card
          title={
            <Space>
              <DiffOutlined />
              <span>File Comparison</span>
            </Space>
          }
          extra={
            <Button icon={<HistoryOutlined />} onClick={() => setViewMode('timeline')}>
              Back to Timeline
            </Button>
          }
        >
          <Descriptions bordered column={2} style={{ marginBottom: 20 }}>
            <Descriptions.Item label="From Commit">
              <Space>
                <Tag color="blue">{comparison.fromCommit.hash.substring(0, 7)}</Tag>
                <span>{comparison.fromCommit.author}</span>
                <span style={{ color: '#999' }}>{formatDate(comparison.fromCommit.date)}</span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="To Commit">
              <Space>
                <Tag color="blue">{comparison.toCommit.hash.substring(0, 7)}</Tag>
                <span>{comparison.toCommit.author}</span>
                <span style={{ color: '#999' }}>{formatDate(comparison.toCommit.date)}</span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="From Message" span={2}>
              {comparison.fromCommit.message}
            </Descriptions.Item>
            <Descriptions.Item label="To Message" span={2}>
              {comparison.toCommit.message}
            </Descriptions.Item>
          </Descriptions>

          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Additions"
                  value={comparison.additions}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<PlusOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Deletions"
                  value={comparison.deletions}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<MinusOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Changed Lines"
                  value={comparison.changedLines}
                  prefix={<EditOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Diff" bodyStyle={{ padding: 0 }}>
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              <SyntaxHighlighter
                language="diff"
                style={isDarkMode ? vscDarkPlus : vs}
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: '13px',
                }}
                showLineNumbers
              >
                {comparison.diff || 'No differences found'}
              </SyntaxHighlighter>
            </div>
          </Card>
        </Card>
      </div>
    );
  };

  const renderCompareModal = () => {
    if (!timeline) return null;

    return (
      <Modal
        title="Compare File Versions"
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        onOk={() => {
          if (selectedFromCommit && selectedToCommit) {
            handleCompare(selectedFromCommit, selectedToCommit);
            setCompareModalVisible(false);
          } else {
            message.warning('Please select both commits to compare');
          }
        }}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>From Commit:</label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select first commit"
              value={selectedFromCommit}
              onChange={setSelectedFromCommit}
              showSearch
              optionFilterProp="children"
            >
              {timeline.history.map((entry) => (
                <Select.Option key={entry.hash} value={entry.hash}>
                  {entry.shortHash} - {entry.message} ({formatDate(entry.date)})
                </Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>To Commit:</label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select second commit"
              value={selectedToCommit}
              onChange={setSelectedToCommit}
              showSearch
              optionFilterProp="children"
            >
              {timeline.history.map((entry) => (
                <Select.Option key={entry.hash} value={entry.hash}>
                  {entry.shortHash} - {entry.message} ({formatDate(entry.date)})
                </Select.Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    );
  };

  const renderVersionModal = () => {
    if (!selectedVersion) return null;

    const getLanguageFromPath = (path: string): string => {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      const langMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'jsx',
        ts: 'typescript',
        tsx: 'tsx',
        py: 'python',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        cs: 'csharp',
        go: 'go',
        rs: 'rust',
        rb: 'ruby',
        php: 'php',
        html: 'html',
        css: 'css',
        scss: 'scss',
        json: 'json',
        xml: 'xml',
        md: 'markdown',
        sql: 'sql',
        sh: 'bash',
      };
      return langMap[ext] || 'text';
    };

    return (
      <Modal
        title="File Version"
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setVersionModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="restore"
            type="primary"
            icon={<RollbackOutlined />}
            onClick={() => {
              setSelectedRestoreCommit(selectedVersion.commitHash);
              setVersionModalVisible(false);
              setRestoreModalVisible(true);
            }}
          >
            Restore This Version
          </Button>,
        ]}
        width="80%"
        style={{ top: 20 }}
      >
        <Descriptions bordered column={2} style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Commit">
            {selectedVersion.commitHash.substring(0, 7)}
          </Descriptions.Item>
          <Descriptions.Item label="Date">
            {formatDate(selectedVersion.date)}
          </Descriptions.Item>
          <Descriptions.Item label="Author">{selectedVersion.author}</Descriptions.Item>
          <Descriptions.Item label="Size">{formatFileSize(selectedVersion.size)}</Descriptions.Item>
          <Descriptions.Item label="Message" span={2}>
            {selectedVersion.message}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          <SyntaxHighlighter
            language={getLanguageFromPath(selectedVersion.filePath)}
            style={isDarkMode ? vscDarkPlus : vs}
            customStyle={{
              margin: 0,
              fontSize: '13px',
            }}
            showLineNumbers
          >
            {selectedVersion.content}
          </SyntaxHighlighter>
        </div>
      </Modal>
    );
  };

  const renderRestoreModal = () => {
    const selectedEntry = timeline?.history.find(
      (e) => e.hash === selectedRestoreCommit
    );

    return (
      <Modal
        title="Restore File"
        open={restoreModalVisible}
        onCancel={() => setRestoreModalVisible(false)}
        onOk={() => handleRestore(selectedRestoreCommit)}
        okText="Restore"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to restore this file to the version from commit:
        </p>
        {selectedEntry && (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong>Commit:</strong> <Tag color="blue">{selectedEntry.shortHash}</Tag>
              </div>
              <div>
                <strong>Message:</strong> {selectedEntry.message}
              </div>
              <div>
                <strong>Author:</strong> {selectedEntry.author}
              </div>
              <div>
                <strong>Date:</strong> {formatDate(selectedEntry.date)}
              </div>
            </Space>
          </Card>
        )}
        <p style={{ marginTop: 16, color: '#ff4d4f' }}>
          <strong>Warning:</strong> This will overwrite the current working directory
          version of the file. Make sure to commit or stash any unsaved changes first.
        </p>
      </Modal>
    );
  };

  if (loading && !timeline) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Spin size="large" tip="Loading file history..." />
      </div>
    );
  }

  if (!timeline) {
    return (
      <div style={{ padding: '20px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>
          {backLabel}
        </Button>
        <Empty description="No file history found" />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`,
          backgroundColor: isDarkMode ? '#141414' : '#fafafa',
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            {backLabel}
          </Button>
          <Divider type="vertical" />
          <FileTextOutlined />
          <span style={{ fontWeight: 500 }}>{filePath}</span>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'timeline' && renderTimeline()}
        {viewMode === 'statistics' && renderStatistics()}
        {viewMode === 'compare' && renderComparison()}
      </div>

      {renderCompareModal()}
      {renderVersionModal()}
      {renderRestoreModal()}
    </div>
  );
};

export default FileHistoryPanel;
