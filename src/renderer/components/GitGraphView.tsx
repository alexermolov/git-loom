import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  const [isDarkTheme, setIsDarkTheme] = useState(
    document.body.classList.contains("dark-theme")
  );

  // In React 18 dev mode, render callbacks may be invoked twice (StrictMode).
  // `buildGraph` is imperative and would otherwise append nodes twice.
  const lastBuiltKeyRef = useRef<string | null>(null);

  const newestHash = commitDetails[0]?.hash ?? "";
  const oldestHash = commitDetails[commitDetails.length - 1]?.hash ?? "";
  const graphKey = useMemo(
    () =>
      `${repoPath}|${selectedBranch}|${commitDetails.length}|${newestHash}|${oldestHash}|${isDarkTheme}`,
    [repoPath, selectedBranch, commitDetails.length, newestHash, oldestHash, isDarkTheme],
  );

  // Отслеживание смены темы и полная очистка при изменении
  useEffect(() => {
    const handleThemeChange = () => {
      const newTheme = document.body.classList.contains("dark-theme");
      if (newTheme !== isDarkTheme) {
        // Полная очистка при смене темы
        lastBuiltKeyRef.current = null;
        setIsDarkTheme(newTheme);
      }
    };

    // Создаем MutationObserver для отслеживания изменений класса body
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [isDarkTheme]);

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
      if (lastBuiltKeyRef.current === graphKey) return;
      lastBuiltKeyRef.current = graphKey;

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

      const formatRefsForCommit = (refs: string[]) => {
        if (!refs || refs.length === 0) return { branches: [], tags: [] };

        const branches: string[] = [];
        const tags: string[] = [];

        for (const ref of refs) {
          const trimmedRef = ref.trim();
          if (trimmedRef.includes("tag:")) {
            const tagName = trimmedRef
              .replace(/.*tag:\s*/, "")
              .split(",")[0]
              .trim();
            if (tagName) tags.push(tagName);
          } else if (trimmedRef.includes("HEAD ->")) {
            const branchName = trimmedRef
              .replace(/.*HEAD -> /, "")
              .split(",")[0]
              .trim();
            if (branchName) branches.push(branchName);
          } else {
            const branchName = normalizeBranchName(trimmedRef.split(",")[0]);
            if (branchName && !branchName.includes("->"))
              branches.push(branchName);
          }
        }

        return {
          branches: Array.from(new Set(branches)),
          tags: Array.from(new Set(tags)),
        };
      };

      const branchNameSet = new Set(branches.map((b) => b.name));
      const pickPreferredBranchName = (names: string[]) =>
        names.find((n) => branchNameSet.has(n)) ?? names[0];

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

      const commitByHash = new Map<string, CommitDetail>();
      const tipByBranch = new Map<string, string>();
      for (const commit of commitDetails) {
        commitByHash.set(commit.hash, commit);
        const names = extractBranchNames(commit.refs || []);
        for (const name of names) {
          if (!tipByBranch.has(name)) {
            tipByBranch.set(name, commit.hash);
          }
        }
      }

      const branchByCommit = new Map<string, string>();
      for (const [branchName, tipHash] of tipByBranch.entries()) {
        const preferredName = pickPreferredBranchName([branchName]);
        let currentHash: string | undefined = tipHash;
        while (currentHash) {
          if (branchByCommit.has(currentHash)) break;
          branchByCommit.set(currentHash, preferredName ?? branchName);
          const current = commitByHash.get(currentHash);
          const parent = current?.parents?.[0];
          if (!parent) break;
          currentHash = parent;
        }
      }

      const branchMap = new Map<string, any>();
      const commitBranchMap = new Map<string, any>();

      const mainBranch = gitgraph.branch(mainBranchName);
      branchMap.set(mainBranchName, mainBranch);

      const getOrCreateBranch = (name: string, parentBranch: any) => {
        if (branchMap.has(name)) return branchMap.get(name);
        const created = parentBranch.branch(name);
        branchMap.set(name, created);
        return created;
      };

      // Defensive: ensure we never try to render the same commit twice.
      // `@gitgraph/react` uses commit hash as a React key internally.
      const seenHashes = new Set<string>();
      const orderedCommits = [...commitDetails]
        .reverse()
        .filter((c) => !!c?.hash)
        .filter((c) => {
          if (seenHashes.has(c.hash)) return false;
          seenHashes.add(c.hash);
          return true;
        });

      for (const commit of orderedCommits) {
        const firstParent = commit.parents[0];
        const parentBranch = firstParent
          ? (commitBranchMap.get(firstParent) ?? mainBranch)
          : mainBranch;

        const assignedBranchName =
          branchByCommit.get(commit.hash) ||
          (firstParent ? branchByCommit.get(firstParent) : undefined) ||
          mainBranchName;

        const targetBranch =
          assignedBranchName === mainBranchName
            ? mainBranch
            : getOrCreateBranch(assignedBranchName, parentBranch);

        if (commit.parents.length > 1) {
          const mergeParents = commit.parents.slice(1);
          let merged = false;
          for (const parentHash of mergeParents) {
            const mergeFrom = commitBranchMap.get(parentHash);
            if (mergeFrom && mergeFrom !== targetBranch) {
              try {
                const refs = formatRefsForCommit(commit.refs || []);
                targetBranch.merge(mergeFrom, {
                  subject: commit.message.substring(0, 50),
                  hash: commit.hash,
                  author: commit.author,
                  renderMessage: (commit: any) => {
                    return (
                      <text
                        alignmentBaseline="central"
                        fill={commit.style.message.color}
                      >
                        {commit.hashAbbrev} {commit.subject}
                        {refs.branches.map((b, i) => (
                          <tspan
                            key={`b-${i}`}
                            fill="#52c41a"
                            fontWeight="bold"
                            dx="8"
                          >
                            [{b}]
                          </tspan>
                        ))}
                        {refs.tags.map((t, i) => (
                          <tspan
                            key={`t-${i}`}
                            fill="#faad14"
                            fontWeight="bold"
                            dx="8"
                          >
                            🏷️{t}
                          </tspan>
                        ))}
                      </text>
                    );
                  },
                });
                merged = true;
                break;
              } catch (e) {
                // continue to fallback
              }
            }
          }

          if (!merged) {
            const refs = formatRefsForCommit(commit.refs || []);
            targetBranch.commit({
              subject: commit.message.substring(0, 50),
              hash: commit.hash,
              author: commit.author,
              renderMessage: (commit: any) => {
                return (
                  <text
                    alignmentBaseline="central"
                    fill={commit.style.message.color}
                  >
                    {commit.hashAbbrev} {commit.subject}
                    {refs.branches.map((b, i) => (
                      <tspan
                        key={`b-${i}`}
                        fill="#52c41a"
                        fontWeight="bold"
                        dx="8"
                      >
                        [{b}]
                      </tspan>
                    ))}
                    {refs.tags.map((t, i) => (
                      <tspan
                        key={`t-${i}`}
                        fill="#faad14"
                        fontWeight="bold"
                        dx="8"
                      >
                        🏷️{t}
                      </tspan>
                    ))}
                  </text>
                );
              },
            });
          }
        } else {
          const refs = formatRefsForCommit(commit.refs || []);
          targetBranch.commit({
            subject: commit.message.substring(0, 50),
            hash: commit.hash,
            author: commit.author,
            renderMessage: (commit: any) => {
              return (
                <text
                  alignmentBaseline="central"
                  fill={commit.style.message.color}
                >
                  {commit.hashAbbrev} {commit.subject}
                  {refs.branches.map((b, i) => (
                    <tspan
                      key={`b-${i}`}
                      fill="#52c41a"
                      fontWeight="bold"
                      dx="8"
                    >
                      [{b}]
                    </tspan>
                  ))}
                  {refs.tags.map((t, i) => (
                    <tspan
                      key={`t-${i}`}
                      fill="#faad14"
                      fontWeight="bold"
                      dx="8"
                    >
                      🏷️{t}
                    </tspan>
                  ))}
                </text>
              );
            },
          });
        }

        commitBranchMap.set(commit.hash, targetBranch);
      }
    },
    [commitDetails, branches, graphKey, isDarkTheme],
  );

  const customTemplate = useMemo(
    () =>
      templateExtend(TemplateName.Metro, {
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
            bgColor: isDarkTheme ? "#1f1f1f" : "#ffffff",
            borderRadius: 5,
          },
        },
        commit: {
          message: {
            displayAuthor: false,
            displayHash: true,
            color: isDarkTheme ? "#e0e0e0" : "#000000",
          },
          spacing: 50,
          dot: {
            size: 6,
          },
        },
      }),
    [isDarkTheme],
  );

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
        <Gitgraph key={graphKey} options={{ template: customTemplate }}>
          {buildGraph}
        </Gitgraph>
      </div>
    </div>
  );
};

export default GitGraphView;
