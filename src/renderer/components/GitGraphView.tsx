import React, { useState, useEffect, useCallback } from 'react';
import { Empty, Spin, Select } from 'antd';
import { Gitgraph, templateExtend, TemplateName } from '@gitgraph/react';
import { CommitDetail } from '../types';

interface GitGraphViewProps {
  repoPath: string;
  branches: Array<{ name: string }>;
}

const GitGraphView: React.FC<GitGraphViewProps> = ({ repoPath, branches }) => {
  const [commitDetails, setCommitDetails] = useState<CommitDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('--all--');

  useEffect(() => {
    loadCommits();
  }, [repoPath, selectedBranch]);

  const loadCommits = async () => {
    if (!repoPath) return;
    
    setLoading(true);
    try {
      const branch = selectedBranch === '--all--' ? undefined : selectedBranch;
      const data = await window.electronAPI.getCommitDetails(repoPath, branch, 100);
      setCommitDetails(data);
    } catch (error) {
      console.error('Failed to load commits:', error);
      setCommitDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const buildGraph = useCallback((gitgraph: any) => {
    if (commitDetails.length === 0) return;

    // Track branches by name
    const branchMap = new Map<string, any>();
    
    // Find initial branch from first commit refs
    let mainBranchName = 'master';
    const firstRefs = commitDetails[commitDetails.length - 1]?.refs || [];
    for (const ref of firstRefs) {
      if (ref.includes('HEAD ->')) {
        mainBranchName = ref.replace(/.*HEAD -> /, '').split(',')[0].trim();
        break;
      } else if (!ref.includes('tag:') && !ref.includes('origin/')) {
        mainBranchName = ref.split(',')[0].trim();
        break;
      }
    }

    // Create main branch
    const mainBranch = gitgraph.branch(mainBranchName);
    branchMap.set(mainBranchName, mainBranch);
    let currentBranch = mainBranch;

    // Process commits in reverse order (oldest first)
    for (let i = commitDetails.length - 1; i >= 0; i--) {
      const commit = commitDetails[i];
      
      // Extract branch names from refs
      const branchNames: string[] = [];
      for (const ref of commit.refs) {
        if (ref.includes('HEAD ->')) {
          const branchName = ref.replace(/.*HEAD -> /, '').split(',')[0].trim();
          branchNames.push(branchName);
        } else if (!ref.includes('tag:') && !ref.includes('origin/')) {
          const branchName = ref.replace(/^origin\//, '').split(',')[0].trim();
          if (branchName && !branchName.includes('->')) {
            branchNames.push(branchName);
          }
        }
      }

      // Determine which branch to commit on
      let targetBranch = currentBranch;
      if (branchNames.length > 0) {
        const branchName = branchNames[0];
        if (!branchMap.has(branchName)) {
          // Create new branch
          targetBranch = currentBranch.branch(branchName);
          branchMap.set(branchName, targetBranch);
        } else {
          targetBranch = branchMap.get(branchName)!;
        }
        currentBranch = targetBranch;
      }

      // Check if this is a merge commit (multiple parents)
      if (commit.parents.length > 1) {
        // Try to merge
        try {
          targetBranch.merge(mainBranch, commit.message.substring(0, 50));
        } catch (e) {
          // Fallback to regular commit if merge fails
          targetBranch.commit({
            subject: commit.message.substring(0, 50),
            hash: commit.hash.substring(0, 7),
            author: commit.author,
          });
        }
      } else {
        // Regular commit
        targetBranch.commit({
          subject: commit.message.substring(0, 50),
          hash: commit.hash.substring(0, 7),
          author: commit.author,
        });
      }
    }
  }, [commitDetails]);

  const customTemplate = templateExtend(TemplateName.Metro, {
    colors: ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'],
    branch: {
      lineWidth: 3,
      spacing: 50,
      label: {
        display: true,
        bgColor: document.body.classList.contains('dark-theme') ? '#1f1f1f' : '#ffffff',
        borderRadius: 5,
      },
    },
    commit: {
      message: {
        displayAuthor: false,
        displayHash: true,
        color: document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#000000',
      },
      spacing: 50,
      dot: {
        size: 6,
      },
    },
  });

  const branchOptions = [
    { label: 'All Branches', value: '--all--' },
    ...branches
      .filter(b => !b.name.startsWith('remotes/'))
      .map(b => ({ label: b.name, value: b.name })),
  ];

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Spin tip="Loading graph..." />
      </div>
    );
  }

  if (commitDetails.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <Empty description="No commits in graph" />
      </div>
    );
  }

  return (
    <div className="git-graph-view">
      <div style={{ marginBottom: 12 }}>
        <Select
          style={{ width: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          dropdownStyle={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          value={selectedBranch}
          onChange={setSelectedBranch}
          options={branchOptions}
          placeholder="Filter by branch"
        />
      </div>
      <div className="git-graph-container-gitgraph" style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: 'calc(100vh - 250px)', background: 'var(--graph-bg)' }}>
        <Gitgraph options={{ template: customTemplate }}>
          {buildGraph}
        </Gitgraph>
      </div>
    </div>
  );
};

export default GitGraphView;
