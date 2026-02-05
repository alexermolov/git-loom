import {
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Modal,
  message,
  Segmented,
  Select,
  Spin,
  type MenuProps,
} from "antd";
import {
  BranchesOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  RollbackOutlined,
  ScissorOutlined,
  SwapOutlined,
  TagOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { CommitDetail, GitGraphRow } from "../types";
import GitGraphSwimlaneView from "./GitGraphSwimlaneView";

interface GitGraphViewProps {
  repoPath: string;
  branches: Array<{ name: string }>;
  onCommitClick?: (commitHash: string, message?: string) => void;
  refreshToken?: number;
}

const GitGraphView: React.FC<GitGraphViewProps> = ({
  repoPath,
  branches,
  onCommitClick,
  refreshToken,
}) => {
  const [viewMode, setViewMode] = useState<"ascii" | "swimlane">("swimlane");
  const [rows, setRows] = useState<GitGraphRow[]>([]);
  const [commitDetails, setCommitDetails] = useState<CommitDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("--all--");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { isDarkMode } = useTheme();

  useEffect(() => {
    loadGraph();
  }, [repoPath, selectedBranch, viewMode, refreshToken]);

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Copied to clipboard");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        message.success("Copied to clipboard");
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        message.error("Failed to copy to clipboard");
      }
    }
  };

  const showCreateBranchModal = (
    commitHash: string,
    defaultSwitchAfterCreate: boolean,
  ) => {
    let branchName = `branch-${commitHash.slice(0, 7)}`;
    let switchAfterCreate = defaultSwitchAfterCreate;

    Modal.confirm({
      title: `Create branch from ${commitHash.slice(0, 7)}`,
      okText: "Create",
      cancelText: "Cancel",
      width: 520,
      className: isDarkMode ? "dark-modal" : "",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            autoFocus
            placeholder="Branch name"
            defaultValue={branchName}
            onChange={(e) => {
              branchName = e.target.value;
            }}
          />
          <Checkbox
            defaultChecked={defaultSwitchAfterCreate}
            onChange={(e) => {
              switchAfterCreate = e.target.checked;
            }}
          >
            Checkout branch after create
          </Checkbox>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Start point: {commitHash}
          </div>
        </div>
      ),
      onOk: async () => {
        const name = branchName.trim();
        if (!name) {
          message.error("Branch name is required");
          return Promise.reject(new Error("Branch name required"));
        }
        try {
          await window.electronAPI.createBranch(repoPath, name, commitHash, switchAfterCreate);
          message.success(`Branch '${name}' created`);
          await loadGraph();
        } catch (error) {
          console.error("Error creating branch:", error);
          message.error("Failed to create branch");
          throw error;
        }
      },
    });
  };

  const confirmCheckoutCommit = (commitHash: string) => {
    Modal.confirm({
      title: "Checkout commit (detached HEAD)",
      okText: "Checkout",
      cancelText: "Cancel",
      icon: <SwapOutlined />,
      className: isDarkMode ? "dark-modal" : "",
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            Checkout <strong>{commitHash.slice(0, 7)}</strong>.
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            This will put you into a detached HEAD state. If you want to keep changes, create a branch.
          </div>
        </div>
      ),
      onOk: async () => {
        try {
          await window.electronAPI.checkoutCommit(repoPath, commitHash);
          message.success(`Checked out ${commitHash.slice(0, 7)} (detached HEAD)`);
          await loadGraph();
        } catch (error) {
          console.error("Error checking out commit:", error);
          message.error("Failed to checkout commit");
          throw error;
        }
      },
    });
  };

  const confirmCherryPick = (commitHash: string, subject?: string) => {
    Modal.confirm({
      title: "Cherry-pick commit",
      okText: "Cherry-pick",
      cancelText: "Cancel",
      icon: <ScissorOutlined />,
      className: isDarkMode ? "dark-modal" : "",
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            Apply commit <strong>{commitHash.slice(0, 7)}</strong> onto current branch.
          </div>
          {subject ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {subject}
            </div>
          ) : null}
        </div>
      ),
      onOk: async () => {
        try {
          await window.electronAPI.cherryPickCommit(repoPath, commitHash);
          message.success(`Cherry-picked ${commitHash.slice(0, 7)}`);
          await loadGraph();
        } catch (error) {
          console.error("Error cherry-picking commit:", error);
          message.error("Cherry-pick failed (possible conflicts)");
          throw error;
        }
      },
    });
  };

  const confirmReset = (commitHash: string, mode: "soft" | "mixed" | "hard") => {
    const modeLabel = mode.toUpperCase();
    Modal.confirm({
      title: `Reset current branch (${modeLabel})`,
      okText: "Reset",
      cancelText: "Cancel",
      icon: <RollbackOutlined />,
      className: isDarkMode ? "dark-modal" : "",
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            Reset current branch to <strong>{commitHash.slice(0, 7)}</strong>.
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            This operation can discard work depending on mode. Make sure you know what you are doing.
          </div>
        </div>
      ),
      onOk: async () => {
        try {
          await window.electronAPI.resetToCommit(repoPath, commitHash, mode);
          message.success(`Reset to ${commitHash.slice(0, 7)} (${mode})`);
          await loadGraph();
        } catch (error) {
          console.error("Error resetting to commit:", error);
          message.error("Failed to reset to commit");
          throw error;
        }
      },
    });
  };

  const confirmRevert = (commitHash: string, subject?: string) => {
    Modal.confirm({
      title: "Revert commit",
      okText: "Revert",
      cancelText: "Cancel",
      icon: <UndoOutlined />,
      className: isDarkMode ? "dark-modal" : "",
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            Create a new commit that reverts <strong>{commitHash.slice(0, 7)}</strong>.
          </div>
          {subject ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {subject}
            </div>
          ) : null}
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
            If conflicts happen, resolve them and use "Continue revert" or "Abort revert".
          </div>
        </div>
      ),
      onOk: async () => {
        try {
          await window.electronAPI.revertCommit(repoPath, commitHash);
          message.success(`Reverted ${commitHash.slice(0, 7)}`);
          await loadGraph();
        } catch (error) {
          console.error("Error reverting commit:", error);
          message.error("Revert failed (possible conflicts or merge commit)");
          throw error;
        }
      },
    });
  };

  const confirmAbortRevert = () => {
    Modal.confirm({
      title: "Abort revert",
      okText: "Abort",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      className: isDarkMode ? "dark-modal" : "",
      content: "Abort the current revert operation (if any).",
      onOk: async () => {
        try {
          const result = await window.electronAPI.abortRevert(repoPath);
          if (result === 'noop') {
            message.info("No revert in progress");
          } else {
            message.success("Revert aborted");
          }
          await loadGraph();
        } catch (error) {
          console.error("Error aborting revert:", error);
          message.error("Failed to abort revert");
          throw error;
        }
      },
    });
  };

  const confirmContinueRevert = () => {
    Modal.confirm({
      title: "Continue revert",
      okText: "Continue",
      cancelText: "Cancel",
      className: isDarkMode ? "dark-modal" : "",
      content: "Continue the current revert operation after resolving conflicts.",
      onOk: async () => {
        try {
          const result = await window.electronAPI.continueRevert(repoPath);
          if (result === 'noop') {
            message.info("No revert in progress");
          } else {
            message.success("Revert continued");
          }
          await loadGraph();
        } catch (error) {
          console.error("Error continuing revert:", error);
          message.error("Failed to continue revert");
          throw error;
        }
      },
    });
  };

  const showCreateTagModal = (commitHash: string, annotated: boolean) => {
    let tagName = "";
    let tagMessage = "";

    Modal.confirm({
      title: annotated ? "Create annotated tag" : "Create lightweight tag",
      okText: "Create",
      cancelText: "Cancel",
      width: 520,
      className: isDarkMode ? "dark-modal" : "",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            autoFocus
            placeholder="Tag name (e.g. v1.2.3)"
            onChange={(e) => {
              tagName = e.target.value;
            }}
          />
          {annotated ? (
            <Input.TextArea
              placeholder="Tag message"
              autoSize={{ minRows: 2, maxRows: 6 }}
              onChange={(e) => {
                tagMessage = e.target.value;
              }}
            />
          ) : null}
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Target: {commitHash}
          </div>
        </div>
      ),
      onOk: async () => {
        const name = tagName.trim();
        if (!name) {
          message.error("Tag name is required");
          return Promise.reject(new Error("Tag name required"));
        }
        try {
          if (annotated) {
            const msg = tagMessage.trim();
            if (!msg) {
              message.error("Tag message is required for annotated tags");
              return Promise.reject(new Error("Tag message required"));
            }
            await window.electronAPI.createAnnotatedTag(repoPath, name, msg, commitHash);
          } else {
            await window.electronAPI.createLightweightTag(repoPath, name, commitHash);
          }
          message.success(`Tag '${name}' created`);
          await loadGraph();
        } catch (error) {
          console.error("Error creating tag:", error);
          message.error("Failed to create tag");
          throw error;
        }
      },
    });
  };

  const getCommitContextMenu = (row: GitGraphRow): MenuProps => {
    const commitHash = row.hash;
    const subject = row.message;

    const items: MenuProps["items"] = [
      {
        key: "open",
        label: "Open commit details",
        icon: <InfoCircleOutlined />,
        disabled: !onCommitClick,
        onClick: () => onCommitClick?.(commitHash, subject),
      },
      {
        key: "copy-hash",
        label: `Copy hash (${commitHash.slice(0, 7)})`,
        icon: <CopyOutlined />,
        onClick: () => copyToClipboard(commitHash),
      },
      {
        key: "copy-short-hash",
        label: `Copy short hash (${commitHash.slice(0, 7)})`,
        icon: <CopyOutlined />,
        onClick: () => copyToClipboard(commitHash.slice(0, 7)),
      },
      {
        key: "copy-subject",
        label: "Copy subject",
        icon: <CopyOutlined />,
        onClick: () => copyToClipboard(subject),
      },
      { type: "divider" },
      {
        key: "create-branch",
        label: "Create branch here…",
        icon: <BranchesOutlined />,
        onClick: () => showCreateBranchModal(commitHash, true),
      },
      {
        key: "create-branch-no-checkout",
        label: "Create branch here (no checkout)…",
        icon: <BranchesOutlined />,
        onClick: () => showCreateBranchModal(commitHash, false),
      },
      {
        key: "checkout-commit",
        label: "Checkout commit (detached HEAD)…",
        icon: <SwapOutlined />,
        onClick: () => confirmCheckoutCommit(commitHash),
      },
      {
        key: "cherry-pick",
        label: "Cherry-pick…",
        icon: <ScissorOutlined />,
        onClick: () => confirmCherryPick(commitHash, subject),
      },
      {
        key: "revert",
        label: "Revert…",
        icon: <UndoOutlined />,
        onClick: () => confirmRevert(commitHash, subject),
      },
      {
        key: "reset",
        label: "Reset current branch",
        icon: <RollbackOutlined />,
        children: [
          {
            key: "reset-soft",
            label: "Soft",
            onClick: () => confirmReset(commitHash, "soft"),
          },
          {
            key: "reset-mixed",
            label: "Mixed",
            onClick: () => confirmReset(commitHash, "mixed"),
          },
          {
            key: "reset-hard",
            label: "Hard",
            danger: true,
            onClick: () => confirmReset(commitHash, "hard"),
          },
        ],
      },
      { type: "divider" },
      {
        key: "tag",
        label: "Tag",
        icon: <TagOutlined />,
        children: [
          {
            key: "tag-lightweight",
            label: "Create lightweight tag…",
            onClick: () => showCreateTagModal(commitHash, false),
          },
          {
            key: "tag-annotated",
            label: "Create annotated tag…",
            onClick: () => showCreateTagModal(commitHash, true),
          },
        ],
      },
      { type: "divider" },
      {
        key: "revert-flow",
        label: "Revert (conflicts)",
        icon: <UndoOutlined />,
        children: [
          {
            key: "revert-continue",
            label: "Continue revert",
            onClick: () => confirmContinueRevert(),
          },
          {
            key: "revert-abort",
            label: "Abort revert",
            danger: true,
            onClick: () => confirmAbortRevert(),
          },
        ],
      },
    ];

    return { items };
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
  const filteredCount =
    viewMode === "ascii" ? filteredRows.length : filteredCommitDetails.length;

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
            { label: "ASCII", value: "ascii" },
            { label: "Swimlanes", value: "swimlane" },
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
              <Dropdown
                key={`${row.hash}-${index}`}
                menu={getCommitContextMenu(row)}
                trigger={["contextMenu"]}
              >
                <div
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
                  style={{ cursor: "context-menu" }}
                >
                  <span className="git-graph-ascii git-graph-ascii-cells">
                    {renderGraphAscii(row.graph)}
                  </span>
                  <span className="git-graph-hash">{row.hash}</span>
                  <span> </span>
                  {renderDecorations(row.message, searchQuery)}
                </div>
              </Dropdown>
            ))}
          </div>
        </div>
      ) : (
        <div className="git-graph-container-gitgraph">
          <GitGraphSwimlaneView
            repoPath={repoPath}
            commitDetails={filteredCommitDetails}
            searchQuery={""}
            onCommitClick={onCommitClick}
            onRefreshRequested={loadGraph}
          />
        </div>
      )}
    </div>
  );
};

export default GitGraphView;
