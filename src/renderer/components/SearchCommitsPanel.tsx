import React, { useState, useEffect } from 'react';
import { Input, Select, DatePicker, Button, List, Spin, Empty, Tag, Space, Tooltip } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined, UserOutlined, BranchesOutlined, CalendarOutlined } from '@ant-design/icons';
import { SearchFilter, SearchResult, CommitFile } from '../types';
import CommitFilesPanel from './CommitFilesPanel';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface SearchCommitsPanelProps {
  selectedRepo: string | null;
  repositories: Map<string, any>;
  onCommitClick: (commit: SearchResult) => void;
  onFileClick: (file: CommitFile) => void;
  selectedCommit?: SearchResult | null;
  commitFiles?: CommitFile[];
  selectedFile?: CommitFile | null;
  loadingFile?: boolean;
}

const SearchCommitsPanel: React.FC<SearchCommitsPanelProps> = ({ 
  selectedRepo, 
  repositories, 
  onCommitClick,
  onFileClick,
  selectedCommit,
  commitFiles = [],
  selectedFile,
  loadingFile
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<string | undefined>(undefined);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [multiRepoResults, setMultiRepoResults] = useState<Record<string, SearchResult[]>>({});
  const [loading, setLoading] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load authors and branches when repo changes
  useEffect(() => {
    if (selectedRepo) {
      loadAuthors();
      loadBranches();
    }
  }, [selectedRepo]);

  const loadAuthors = async () => {
    if (!selectedRepo) return;
    try {
      const authorList = await window.electronAPI.getAuthors(selectedRepo);
      setAuthors(authorList);
    } catch (error) {
      console.error('Error loading authors:', error);
    }
  };

  const loadBranches = async () => {
    if (!selectedRepo) return;
    try {
      const branchList = await window.electronAPI.getBranches(selectedRepo);
      setBranches(branchList.map((b: any) => b.name));
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && !selectedAuthor && !selectedBranch && !dateRange) {
      return;
    }

    setLoading(true);
    setResults([]);
    setMultiRepoResults({});

    try {
      const filter: SearchFilter = {
        query: searchQuery.trim() || undefined,
        author: selectedAuthor,
        branch: selectedBranch,
        dateFrom: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateTo: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      };

      if (searchScope === 'current' && selectedRepo) {
        const searchResults = await window.electronAPI.searchCommits(selectedRepo, filter, 100);
        setResults(searchResults);
      } else {
        const repoPaths = Array.from(repositories.keys());
        const multiResults = await window.electronAPI.searchCommitsMultiRepo(repoPaths, filter, 100);
        setMultiRepoResults(multiResults);
      }
    } catch (error) {
      console.error('Error searching commits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSelectedAuthor(undefined);
    setSelectedBranch(undefined);
    setDateRange(null);
    setResults([]);
    setMultiRepoResults({});
  };

  const formatDate = (dateString: string) => {
    return dayjs(dateString).format('YYYY-MM-DD HH:mm');
  };

  const getRepoName = (repoPath: string) => {
    const repoInfo = repositories.get(repoPath);
    return repoInfo?.name || repoPath.split(/[/\\]/).pop() || repoPath;
  };

  const renderCommitItem = (commit: SearchResult, repoPath?: string) => {
    const isSelected = selectedCommit?.hash === commit.hash;
    return (
      <List.Item
        key={`${repoPath || selectedRepo}-${commit.hash}`}
        className="search-result-item"
        onClick={() => onCommitClick(commit)}
        style={{ 
          cursor: 'pointer',
          backgroundColor: isSelected ? 'var(--primary-bg-hover)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
        }}
      >
        <List.Item.Meta
          title={
            <Space>
              <Tooltip title={commit.hash}>
                <Tag color="blue">{commit.hash.substring(0, 7)}</Tag>
              </Tooltip>
              <span>{commit.message}</span>
              {commit.refs && commit.refs.split(',').map((ref, idx) => (
                <Tag key={idx} color="green" style={{ fontSize: '11px' }}>
                  {ref.trim()}
                </Tag>
              ))}
            </Space>
          }
          description={
            <Space direction="vertical" size={0}>
              <Space>
                <UserOutlined />
                <span>{commit.author}</span>
                <CalendarOutlined />
                <span>{formatDate(commit.date)}</span>
              </Space>
              {repoPath && (
                <Space>
                  <BranchesOutlined />
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{getRepoName(repoPath)}</span>
                </Space>
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  // Determine if we should show the files panel (when a commit is selected)
  const showFilesPanel = selectedCommit && commitFiles.length > 0;

  return (
    <div className="search-commits-panel" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%' 
    }}>
      {/* Upper section: Search + Results */}
      <div className="search-section" style={{ 
        flex: showFilesPanel ? '0 0 50%' : '1 1 100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderBottom: showFilesPanel ? '1px solid var(--border-color)' : 'none',
      }}>
        <div className="search-panel-header" style={{ 
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Search Commits</h3>
          {selectedRepo && (
            <Select
              value={searchScope}
              onChange={setSearchScope}
              style={{ width: 150 }}
              size="small"
            >
              <Option value="current">Current Repo</Option>
              <Option value="all">All Repos</Option>
            </Select>
          )}
        </div>

        <div className="search-controls" style={{ padding: '12px 16px' }}>
          <Input.Search
            placeholder="Search by message or hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
            size="large"
            allowClear
          />

          <Space style={{ marginTop: 10 }}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? 'primary' : 'default'}
              size="small"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="small"
            >
              Clear
            </Button>
          </Space>

          {showFilters && (
            <div className="search-filters" style={{ marginTop: 10 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  placeholder="Filter by author"
                  value={selectedAuthor}
                  onChange={setSelectedAuthor}
                  allowClear
                  showSearch
                  style={{ width: '100%' }}
                >
                  {authors.map((author) => (
                    <Option key={author} value={author}>{author}</Option>
                  ))}
                </Select>

                {selectedRepo && (
                  <Select
                    placeholder="Filter by branch"
                    value={selectedBranch}
                    onChange={setSelectedBranch}
                    allowClear
                    showSearch
                    style={{ width: '100%' }}
                  >
                    {branches.map((branch) => (
                      <Option key={branch} value={branch}>{branch}</Option>
                    ))}
                  </Select>
                )}

                <RangePicker
                  placeholder={['From date', 'To date']}
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ width: '100%' }}
                />
              </Space>
            </div>
          )}
        </div>

        <div className="search-results" style={{ 
          flex: 1, 
          overflow: 'auto',
          padding: '0'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" tip="Searching..." />
            </div>
          ) : searchScope === 'current' ? (
            results.length > 0 ? (
              <>
                <div style={{ padding: '10px 16px', fontWeight: 'bold', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                  Found {results.length} result(s)
                </div>
                <List
                  dataSource={results}
                  renderItem={(commit) => renderCommitItem(commit)}
                />
              </>
            ) : (searchQuery || selectedAuthor || selectedBranch || dateRange) ? (
              <Empty description="No commits found" style={{ marginTop: 40 }} />
            ) : (
              <Empty description="Enter search criteria to find commits" style={{ marginTop: 40 }} />
            )
          ) : (
            Object.keys(multiRepoResults).length > 0 ? (
              <>
                <div style={{ padding: '10px 16px', fontWeight: 'bold', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                  Found results in {Object.keys(multiRepoResults).length} repository(ies)
                </div>
                {Object.entries(multiRepoResults).map(([repoPath, commits]) => (
                  <div key={repoPath} style={{ marginBottom: 20 }}>
                    <div style={{ 
                      padding: '8px 16px', 
                      background: 'var(--bg-secondary)', 
                      fontWeight: 'bold',
                      borderLeft: '4px solid var(--accent-color)',
                      color: 'var(--text-primary)'
                    }}>
                      {getRepoName(repoPath)} ({commits.length})
                    </div>
                    <List
                      dataSource={commits}
                      renderItem={(commit) => renderCommitItem(commit, repoPath)}
                    />
                  </div>
                ))}
              </>
            ) : (searchQuery || selectedAuthor || selectedBranch || dateRange) ? (
              <Empty description="No commits found in any repository" style={{ marginTop: 40 }} />
            ) : (
              <Empty description="Enter search criteria to find commits" style={{ marginTop: 40 }} />
            )
          )}
        </div>
      </div>

      {/* Lower section: Files (only visible when commit is selected) */}
      {showFilesPanel && (
        <div className="files-section" style={{ 
          flex: '0 0 50%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '8px 16px', 
            fontWeight: 600, 
            fontSize: '14px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)'
          }}>
            Changed Files
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CommitFilesPanel
              files={commitFiles}
              commitHash={selectedCommit.hash}
              onFileClick={onFileClick}
              selectedFile={selectedFile}
              loadingFile={loadingFile}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchCommitsPanel;
