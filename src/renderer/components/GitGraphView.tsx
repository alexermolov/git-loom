import React, { useState, useEffect, useCallback } from "react";
import { Empty, Spin, Select } from "antd";
import { Gitgraph, templateExtend, TemplateName } from "@gitgraph/react";
import { CommitDetail } from "../types";

interface GitGraphViewProps {
  repoPath: string;
  branches: Array<{ name: string }>;
}

const GitGraphView: React.FC<GitGraphViewProps> = ({ repoPath, branches }) => {
  const [commitDetails, setCommitDetails] = useState<CommitDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("--all--");

  useEffect(() => {
    loadCommits();
  }, [repoPath, selectedBranch]);

  const loadCommits = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const branch = selectedBranch === "--all--" ? undefined : selectedBranch;
      const data = await window.electronAPI.getCommitDetails(
        repoPath,
        branch,
        100,
      );
      setCommitDetails(data);
    } catch (error) {
      console.error("Failed to load commits:", error);
      setCommitDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const buildGraph = useCallback(
    (gitgraph: any) => {
      if (commitDetails.length === 0) return;

      const normalizeBranchName = (ref: string) =>
        ref
          .replace(/^remotes\/[^\/]+\//, "")
          .replace(/^origin\//, "")
          .trim();

      const extractBranchNames = (refs: string[]) => {
        const names: string[] = [];
        for (const ref of refs) {
          if (ref.includes("HEAD ->")) {
            const branchName = ref
              .replace(/.*HEAD -> /, "")
              .split(",")[0]
              .trim();
            if (branchName.length > 0) names.push(branchName);
            continue;
          }
          if (ref.includes("tag:")) continue;
          const branchName = normalizeBranchName(ref.split(",")[0]);
          if (branchName && !branchName.includes("->")) names.push(branchName);
        }
        return Array.from(new Set(names));
      };

      const newestRefs = commitDetails[0]?.refs || [];
      let mainBranchName = "master";
      for (const ref of newestRefs) {
        if (ref.includes("HEAD ->")) {
          mainBranchName = ref
            .replace(/.*HEAD -> /, "")
            .split(",")[0]
            .trim();
          break;
        }
      }

      if (!mainBranchName || mainBranchName === "master") {
        if (branches.some((b) => b.name === "main")) {
          mainBranchName = "main";
        } else if (branches.length > 0) {
          mainBranchName = branches[0].name;
        }
      }

      const branchMap = new Map<string, any>();
      const commitBranchMap = new Map<string, any>();

      const mainBranch = gitgraph.branch(mainBranchName);
      branchMap.set(mainBranchName, mainBranch);

      const orderedCommits = [...commitDetails].reverse();

      for (const commit of orderedCommits) {
        const branchNames = extractBranchNames(commit.refs || []);

        let targetBranch = mainBranch;
        const firstParent = commit.parents[0];
        if (firstParent && commitBranchMap.has(firstParent)) {
          targetBranch = commitBranchMap.get(firstParent);
        }

        if (branchNames.length > 0) {
          const preferredBranchName = branchNames[0];
          if (!branchMap.has(preferredBranchName)) {
            const created = targetBranch.branch(preferredBranchName);
            branchMap.set(preferredBranchName, created);
          }
          targetBranch = branchMap.get(preferredBranchName);
        }

        for (const branchName of branchNames) {
          if (!branchMap.has(branchName)) {
            branchMap.set(branchName, targetBranch.branch(branchName));
          }
        }

        if (commit.parents.length > 1) {
          const mergeParents = commit.parents.slice(1);
          let merged = false;
          for (const parentHash of mergeParents) {
            const mergeFrom = commitBranchMap.get(parentHash);
            if (mergeFrom && mergeFrom !== targetBranch) {
              try {
                targetBranch.merge(mergeFrom, {
                  subject: commit.message.substring(0, 50),
                  hash: commit.hash.substring(0, 7),
                  author: commit.author,
                });
                merged = true;
                break;
              } catch (e) {
                // continue to fallback
              }
            }
          }

          if (!merged) {
            targetBranch.commit({
              subject: commit.message.substring(0, 50),
              hash: commit.hash.substring(0, 7),
              author: commit.author,
            });
          }
        } else {
          targetBranch.commit({
            subject: commit.message.substring(0, 50),
            hash: commit.hash.substring(0, 7),
            author: commit.author,
          });
        }

        commitBranchMap.set(commit.hash, targetBranch);
      }
    },
    [commitDetails, branches],
  );

  const customTemplate = templateExtend(TemplateName.Metro, {
    colors: [
      "#1890ff",
      "#52c41a",
      "#faad14",
      "#f5222d",
      "#722ed1",
      "#13c2c2",
      "#eb2f96",
      "#fa8c16",
    ],
    branch: {
      lineWidth: 3,
      spacing: 50,
      label: {
        display: true,
        bgColor: document.body.classList.contains("dark-theme")
          ? "#1f1f1f"
          : "#ffffff",
        borderRadius: 5,
      },
    },
    commit: {
      message: {
        displayAuthor: false,
        displayHash: true,
        color: document.body.classList.contains("dark-theme")
          ? "#e0e0e0"
          : "#000000",
      },
      spacing: 50,
      dot: {
        size: 6,
      },
    },
  });

  const branchOptions = [
    { label: "All Branches", value: "--all--" },
    ...branches
      .filter((b) => !b.name.startsWith("remotes/"))
      .map((b) => ({ label: b.name, value: b.name })),
  ];

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
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
          style={{
            width: "100%",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
          dropdownStyle={{
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
          value={selectedBranch}
          onChange={setSelectedBranch}
          options={branchOptions}
          placeholder="Filter by branch"
        />
      </div>
      <div className="git-graph-container-gitgraph">
        <Gitgraph options={{ template: customTemplate }}>{buildGraph}</Gitgraph>
      </div>
    </div>
  );
};

export default GitGraphView;
