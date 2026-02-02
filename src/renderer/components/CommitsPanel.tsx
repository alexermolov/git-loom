import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Empty, message, Tooltip, Spin } from 'antd';
import { CopyOutlined, LoadingOutlined } from '@ant-design/icons';
import { CommitInfo } from '../types';

interface CommitsPanelProps {
  commits: CommitInfo[];
  onCommitClick?: (commit: CommitInfo) => void;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
}

const CommitsPanel: React.FC<CommitsPanelProps> = ({ commits, onCommitClick, onLoadMore, hasMore = false }) => {
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling state
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const itemHeight = 80; // Estimated height of each commit item
  const overscan = 5; // Number of items to render outside visible area

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
    if (!onLoadMore || !hasMore || !sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !loading && hasMore) {
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
  }, [onLoadMore, hasMore, loading]);

  // Handle virtual scrolling
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const scrollTop = scrollContainerRef.current.scrollTop;
    const containerHeight = scrollContainerRef.current.clientHeight;

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      commits.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    setVisibleRange({ start, end });
  }, [commits.length, itemHeight, overscan]);

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
    if (!onLoadMore || loading || !hasMore) return;

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

  // Get visible commits for virtual scrolling
  const visibleCommits = commits.slice(visibleRange.start, visibleRange.end);
  const offsetY = visibleRange.start * itemHeight;
  const totalHeight = commits.length * itemHeight;

  return (
    <div className="commits-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
        Commits ({commits.length}{hasMore ? '+' : ''})
      </div>
      
      {commits.length === 0 ? (
        <div style={{ padding: 20 }}>
          <Empty description="No commits found" />
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleCommits.map((commit, index) => {
                const actualIndex = visibleRange.start + index;
                return (
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
                );
              })}
            </div>
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
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
