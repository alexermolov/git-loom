import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, DatePicker, Empty, Input, message, Select, Space, Spin, Tooltip } from 'antd';
import { ClearOutlined, CopyOutlined, FilterOutlined, LoadingOutlined, SearchOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { CommitInfo, SearchFilter } from '../types';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface CommitsPanelProps {
  repoPath: string;
  commits: CommitInfo[];
  onCommitClick?: (commit: CommitInfo) => void;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
}

const CommitsPanel: React.FC<CommitsPanelProps> = ({ repoPath, commits, onCommitClick, onLoadMore, hasMore = false }) => {
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<string | undefined>(undefined);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchResults, setSearchResults] = useState<CommitInfo[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling state
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const itemHeight = 80; // Estimated height of each commit item
  const overscan = 5; // Number of items to render outside visible area
  const displayedCommits = isSearchActive ? searchResults : commits;
  const canLoadMore = !isSearchActive && hasMore;

  useEffect(() => {
    const loadSearchFilters = async () => {
      if (!repoPath) return;

      try {
        const [authorList, branchList] = await Promise.all([
          window.electronAPI.getAuthors(repoPath),
          window.electronAPI.getBranches(repoPath),
        ]);
        setAuthors(authorList);
        setBranches(branchList.map((branch: any) => branch.name));
      } catch (error) {
        console.error('Error loading commit search filters:', error);
      }
    };

    loadSearchFilters();
    handleClear();
  }, [repoPath]);

  const copyHashToClipboard = async (hash: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      message.success('Commit hash copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      message.error('Failed to copy commit hash');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatHash = (hash: string) => {
    return hash.substring(0, 7);
  };

  // Handle infinite scroll
  useEffect(() => {
    if (!onLoadMore || !canLoadMore || !sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !loading && canLoadMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, canLoadMore, loading]);

  // Handle virtual scrolling
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const scrollTop = scrollContainerRef.current.scrollTop;
    const containerHeight = scrollContainerRef.current.clientHeight;

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      displayedCommits.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    setVisibleRange({ start, end });
  }, [displayedCommits.length, itemHeight, overscan]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const handleLoadMore = async () => {
    if (!onLoadMore || loading || !canLoadMore) return;

    setLoading(true);
    try {
      await onLoadMore();
    } catch (error) {
      console.error('Failed to load more commits:', error);
      message.error('Failed to load more commits');
    } finally {
      setLoading(false);
    }
  };

  const hasSearchCriteria = () => (
    Boolean(searchQuery.trim() || selectedAuthor || selectedBranch || dateRange)
  );

  const handleSearch = async () => {
    if (!hasSearchCriteria()) {
      handleClear();
      return;
    }

    setSearchLoading(true);
    setIsSearchActive(true);

    try {
      const filter: SearchFilter = {
        query: searchQuery.trim() || undefined,
        author: selectedAuthor,
        branch: selectedBranch,
        dateFrom: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateTo: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      };

      const results = await window.electronAPI.searchCommits(repoPath, filter, 100);
      setSearchResults(results);
      setVisibleRange({ start: 0, end: 50 });
      scrollContainerRef.current?.scrollTo({ top: 0 });
    } catch (error) {
      console.error('Error searching commits:', error);
      message.error('Failed to search commits');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSelectedAuthor(undefined);
    setSelectedBranch(undefined);
    setDateRange(null);
    setSearchResults([]);
    setIsSearchActive(false);
    setVisibleRange({ start: 0, end: 50 });
  };

  // Get visible commits for virtual scrolling
  const visibleCommits = displayedCommits.slice(visibleRange.start, visibleRange.end);
  const offsetY = visibleRange.start * itemHeight;
  const totalHeight = displayedCommits.length * itemHeight;

  return (
    <div className="commits-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
        {isSearchActive ? 'Search Results' : 'Commits'} ({displayedCommits.length}{canLoadMore ? '+' : ''})
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
        <Input.Search
          placeholder="Search by message or hash..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onSearch={handleSearch}
          enterButton={<SearchOutlined />}
          allowClear
          loading={searchLoading}
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
          <Button icon={<ClearOutlined />} onClick={handleClear} size="small">
            Clear
          </Button>
        </Space>

        {showFilters && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 10 }}>
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
            <RangePicker
              placeholder={['From date', 'To date']}
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
            />
          </Space>
        )}
      </div>

      {searchLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin size="large" tip="Searching..." />
        </div>
      ) : displayedCommits.length === 0 ? (
        <div style={{ padding: 20 }}>
          <Empty description={isSearchActive ? 'No commits found' : 'No commits found'} />
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleCommits.map((commit) => (
                  <div 
                    key={commit.hash} 
                    className="commit-item"
                    onClick={() => onCommitClick && onCommitClick(commit)}
                    style={{ 
                      cursor: onCommitClick ? 'pointer' : 'default',
                      minHeight: itemHeight,
                    }}
                  >
                    <div className="commit-message">{commit.message}</div>
                    <div className="commit-meta">
                      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tooltip title="Click to copy full hash">
                          <span 
                            className="commit-hash" 
                            onClick={(e) => copyHashToClipboard(commit.hash, e)}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {formatHash(commit.hash)}
                            <CopyOutlined style={{ fontSize: 11, opacity: 0.6 }} />
                          </span>
                        </Tooltip>
                        {commit.refs && (
                          <span style={{ marginLeft: 8, color: '#52c41a' }}>
                            {commit.refs}
                          </span>
                        )}
                      </div>
                      <div>{commit.author}</div>
                      <div>{formatDate(commit.date)}</div>
                    </div>
                  </div>
              ))}
            </div>
          </div>

          {/* Infinite scroll sentinel */}
          {canLoadMore && (
            <div ref={sentinelRef} style={{ height: 20, margin: '10px 0' }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: '10px' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                    Loading more commits...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommitsPanel;
