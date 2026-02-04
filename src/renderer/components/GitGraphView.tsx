import { Empty, Input, Segmented, Select, Spin } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { CommitDetail, GitGraphRow } from "../types";
import GitGraphSwimlaneView from "./GitGraphSwimlaneView";

interface GitGraphViewProps {
  repoPath: string;
  branches: Array<{ name: string }>;
  onCommitClick?: (commitHash: string, message?: string) => void;
}

const GitGraphView: React.FC<GitGraphViewProps> = ({
  repoPath,
  branches,
  onCommitClick,
}) => {
  const [viewMode, setViewMode] = useState<"ascii" | "swimlane">("ascii");
  const [rows, setRows] = useState<GitGraphRow[]>([]);
  const [commitDetails, setCommitDetails] = useState<CommitDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("--all--");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { isDarkMode } = useTheme();

  useEffect(() => {
    loadGraph();
  }, [repoPath, selectedBranch, viewMode]);

  // Reset local search when switching repos/branches
  useEffect(() => {
    setSearchQuery("");
  }, [repoPath, selectedBranch]);

  const loadGraph = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const branch = selectedBranch === "--all--" ? undefined : selectedBranch;
      if (viewMode === "ascii") {
        const data = await window.electronAPI.getGitGraph(repoPath, branch);
        setRows(data);
        setCommitDetails([]);
      } else {
        const details = await window.electronAPI.getCommitDetails(
          repoPath,
          branch,
          200,
        );
        setCommitDetails(details);
        setRows([]);
      }
    } catch (error) {
      console.error("Failed to load git graph:", error);
      setRows([]);
      setCommitDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const renderGraphAscii = useMemo(() => {
    const classForChar = (ch: string) => {
      switch (ch) {
        case "|":
          return "git-graph-cell git-graph-cell-vert";
        case "-":
        case "_":
          return "git-graph-cell git-graph-cell-horiz";
        case "/":
          return "git-graph-cell git-graph-cell-diag-fwd";
        case "\\":
          return "git-graph-cell git-graph-cell-diag-back";
        case "*":
        case "o":
        case "●":
        case "+":
          return "git-graph-cell git-graph-cell-node";
        case " ":
          return "git-graph-cell git-graph-cell-space";
        default:
          return "git-graph-cell git-graph-cell-char";
      }
    };

    return (graph: string) => {
      const chars = Array.from(graph ?? "");
      return chars.map((ch, i) => (
        <span key={`g-${i}`} className={classForChar(ch)}>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ));
    };
  }, []);

  const renderDecorations = useMemo(() => {
    const escapeRegExp = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const highlightText = (text: string, query: string) => {
      const q = query.trim();
      if (!q) return text;
      const re = new RegExp(escapeRegExp(q), "ig");
      const parts = text.split(re);
      const matches = text.match(re);
      if (!matches || parts.length === 1) return text;

      const out: React.ReactNode[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) out.push(parts[i]);
        if (i < (matches?.length ?? 0)) {
          out.push(
            <span key={`h-${i}`} className="git-graph-highlight">
              {matches[i]}
            </span>,
          );
        }
      }
      return out;
    };

    const render = (message: string, query: string) => {
      const match = message.match(/^\(([^)]+)\)\s*(.*)$/);
      if (!match) {
        return (
          <span className="git-graph-subject">
            {highlightText(message, query)}
          </span>
        );
      }

      const decorationsRaw = match[1];
      const subject = match[2] ?? "";

      const tokens = decorationsRaw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      return (
        <>
          <span className="git-graph-paren">(</span>
          {tokens.map((token, index) => {
            const lower = token.toLowerCase();
            const isTag = lower.startsWith("tag:");
            const isHead = token.includes("HEAD ->");
            const isRemote = !isTag && !isHead && token.includes("/");

            const className = isTag
              ? "git-graph-deco git-graph-deco-tag"
              : isHead
                ? "git-graph-deco git-graph-deco-head"
                : isRemote
                  ? "git-graph-deco git-graph-deco-remote"
                  : "git-graph-deco git-graph-deco-branch";

            return (
              <React.Fragment key={`${token}-${index}`}>
                {index > 0 ? <span className="git-graph-comma">, </span> : null}
                <span className={className}>{highlightText(token, query)}</span>
              </React.Fragment>
            );
          })}
          <span className="git-graph-paren">)</span>
          {subject.length > 0 ? (
            <>
              <span> </span>
              <span className="git-graph-subject">
                {highlightText(subject, query)}
              </span>
            </>
          ) : null}
        </>
      );
    };

    return render;
  }, [isDarkMode]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.hash} ${r.message}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchQuery]);

  const filteredCommitDetails = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return commitDetails;
    return commitDetails.filter((c) => {
      const refs = (c.refs ?? []).join(" ");
      const hay = `${c.hash} ${c.message} ${c.author} ${refs}`.toLowerCase();
      return hay.includes(q);
    });
  }, [commitDetails, searchQuery]);

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

  const totalCount = viewMode === "ascii" ? rows.length : commitDetails.length;
  const filteredCount = viewMode === "ascii" ? filteredRows.length : filteredCommitDetails.length;

  if (totalCount === 0) {
    return (
      <div style={{ padding: 20 }}>
        <Empty description="No commits in graph" />
      </div>
    );
  }

  return (
    <div className="git-graph-view">
      <div style={{ marginBottom: 12 }}>
        <Segmented
          block
          value={viewMode}
          onChange={(value) => setViewMode(value as "ascii" | "swimlane")}
          options={[
            { label: "Current (ASCII)", value: "ascii" },
            { label: "New (Swimlanes)", value: "swimlane" },
          ]}
        />
      </div>
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
      <div style={{ marginBottom: 12 }}>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search in graph (hash, branch, tag, subject)"
          allowClear
        />
      </div>
      {searchQuery.trim().length > 0 ? (
        <div
          style={{
            marginBottom: 8,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          Showing {filteredCount} of {totalCount}
        </div>
      ) : null}
      {viewMode === "ascii" ? (
        <div className="git-graph-container-gitgraph">
          <div className="git-graph-text" role="log" aria-label="Git graph">
            {filteredRows.map((row, index) => (
              <div
                key={`${row.hash}-${index}`}
                className="git-graph-line"
                title={row.hash}
                role={onCommitClick ? "button" : undefined}
                tabIndex={onCommitClick ? 0 : -1}
                onClick={
                  onCommitClick
                    ? () => onCommitClick(row.hash, row.message)
                    : undefined
                }
                onKeyDown={
                  onCommitClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onCommitClick(row.hash, row.message);
                        }
                      }
                    : undefined
                }
              >
                <span className="git-graph-ascii git-graph-ascii-cells">
                  {renderGraphAscii(row.graph)}
                </span>
                <span className="git-graph-hash">{row.hash}</span>
                <span> </span>
                {renderDecorations(row.message, searchQuery)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="git-graph-container-gitgraph">
          <GitGraphSwimlaneView
            commitDetails={filteredCommitDetails}
            searchQuery={""}
            onCommitClick={onCommitClick}
          />
        </div>
      )}
    </div>
  );
};

export default GitGraphView;
