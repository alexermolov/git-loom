import React, { useState } from "react";
import { Button, Spin, Badge, Tooltip, Input, Tag } from "antd";
import {
  FolderOpenOutlined,
  BranchesOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  BulbFilled,
} from "@ant-design/icons";
import { useTheme } from "../ThemeContext";
import { RepositoryInfo } from "../types";
import BranchSwitcher from "./BranchSwitcher";

interface SidebarProps {
  repositories: RepositoryInfo[];
  selectedRepo: string | null;
  onSelectRepo: (repoPath: string) => void;
  onOpenFolder: () => void;
  onRefresh?: () => void;
  onPullRepo?: (repoPath: string) => void;
  onPushRepo?: (repoPath: string) => void;
  repoOps?: Record<string, "pull" | "push" | undefined>;
  scanning: boolean;
  refreshing?: boolean;
  onToggleTheme?: () => void;
  loadingProgress?: { current: number; total: number };
  onBranchSwitch?: (repoPath: string, branchName: string) => Promise<void>;
  onStashAndSwitch?: (repoPath: string, branchName: string) => Promise<void>;
  onDiscardAndSwitch?: (repoPath: string, branchName: string) => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({
  repositories,
  selectedRepo,
  onSelectRepo,
  onOpenFolder,
  onRefresh,
  onPullRepo,
  onPushRepo,
  repoOps = {},
  scanning,
  refreshing = false,
  onToggleTheme,
  loadingProgress,
  onBranchSwitch,
  onStashAndSwitch,
  onDiscardAndSwitch,
}) => {
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [branchSwitcherVisible, setBranchSwitcherVisible] = useState(false);
  const [branchSwitcherRepo, setBranchSwitcherRepo] = useState<string | null>(
    null,
  );

  // Filter repositories based on search query
  const filteredRepositories = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.path.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleBranchLabelClick = (e: React.MouseEvent, repoPath: string) => {
    e.stopPropagation();
    setBranchSwitcherRepo(repoPath);
    setBranchSwitcherVisible(true);
  };

  const handleBranchSwitchInternal = async (branchName: string) => {
    if (!branchSwitcherRepo || !onBranchSwitch) {
      throw new Error("Branch switch handler not available");
    }
    await onBranchSwitch(branchSwitcherRepo, branchName);
  };

  const handleStashAndSwitchInternal = async (branchName: string) => {
    if (!branchSwitcherRepo || !onStashAndSwitch) {
      throw new Error("Stash and switch handler not available");
    }
    await onStashAndSwitch(branchSwitcherRepo, branchName);
  };

  const handleDiscardAndSwitchInternal = async (branchName: string) => {
    if (!branchSwitcherRepo || !onDiscardAndSwitch) {
      throw new Error("Discard and switch handler not available");
    }
    await onDiscardAndSwitch(branchSwitcherRepo, branchName);
  };

  const getCurrentBranchForSwitcher = () => {
    if (!branchSwitcherRepo) return "";
    const repo = repositories.find((r) => r.path === branchSwitcherRepo);
    return repo?.currentBranch || "";
  };

  const statPillStyle = (variant: "outgoing" | "incoming", active: boolean) => {
    if (active) {
      return variant === "outgoing"
        ? {
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "2px 6px",
            backgroundColor: "#f6ffed",
            border: "1px solid #b7eb8f",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: "#52c41a",
          }
        : {
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "2px 6px",
            backgroundColor: "#e6f7ff",
            border: "1px solid #91d5ff",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: "#1890ff",
          };
    }

    return {
      display: "flex",
      alignItems: "center",
      gap: 2,
      padding: "2px 6px",
      backgroundColor: "#f0f0f0",
      border: "1px solid #d9d9d9",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      color: "#8c8c8c",
    };
  };

  return (
    <div
      className="sidebar"
      style={{
        width: collapsed ? "48px" : "300px",
        minWidth: collapsed ? "48px" : "300px",
        transition: "width 0.3s, min-width 0.3s",
      }}
    >
      <div className="sidebar-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: collapsed ? 0 : 8,
          }}
        >
          <Tooltip title={collapsed ? "Expand panel" : "Collapse panel"}>
            <Button
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              size="small"
              style={{ flexShrink: 0 }}
            />
          </Tooltip>
          {!collapsed && onToggleTheme && (
            <Tooltip title={`Switch to ${isDarkMode ? "light" : "dark"} theme`}>
              <Button
                icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
                onClick={onToggleTheme}
                size="small"
                style={{ color: isDarkMode ? "#ffd700" : "#666" }}
              />
            </Tooltip>
          )}
        </div>
        {!collapsed && (
          <>
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              onClick={onOpenFolder}
              loading={scanning}
              block
              style={{ marginBottom: 8 }}
            >
              {scanning ? "Scanning..." : "Open Folder"}
            </Button>
            {repositories.length > 0 && (
              <>
                <Tooltip title="Refresh all repositories">
                  <Button
                    icon={<ReloadOutlined spin={refreshing} />}
                    onClick={onRefresh}
                    disabled={scanning || refreshing}
                    block
                    style={{ marginBottom: 8 }}
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                </Tooltip>
                <Input
                  placeholder="Search repositories..."
                  prefix={<SearchOutlined />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                />
              </>
            )}
          </>
        )}
      </div>

      {!collapsed && (
        <div className="sidebar-content">
          {scanning ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <Spin tip="Scanning for repositories..." />
              {loadingProgress && loadingProgress.total > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      marginBottom: "8px",
                      color: isDarkMode ? "#d4d4d4" : "#333",
                    }}
                  >
                    {loadingProgress.current} / {loadingProgress.total}(
                    {Math.round(
                      (loadingProgress.current / loadingProgress.total) * 100,
                    )}
                    %)
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: isDarkMode ? "#333" : "#e0e0e0",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                        height: "100%",
                        backgroundColor: "#1890ff",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : repositories.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
              <p>No repositories loaded</p>
              <p style={{ fontSize: 12 }}>Click "Open Folder" to scan</p>
            </div>
          ) : filteredRepositories.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
              <p>No repositories found</p>
              <p style={{ fontSize: 12 }}>Try a different search term</p>
            </div>
          ) : (
            filteredRepositories.map((repo) => (
              <div
                key={repo.path}
                className={`repository-item ${selectedRepo === repo.path ? "active" : ""}`}
                onClick={() => onSelectRepo(repo.path)}
              >
                <div className="repository-name">{repo.name}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Tooltip title="Click to switch branch">
                    <div
                      className="repository-branch"
                      onClick={(e) => handleBranchLabelClick(e, repo.path)}
                      style={{
                        cursor: "pointer",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode
                          ? "#333"
                          : "#f0f0f0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <BranchesOutlined /> {repo.currentBranch}
                    </div>
                  </Tooltip>
                </div>

                {/* File status indicators */}
                {(repo.status.modified.length > 0 ||
                  repo.status.created.length > 0 ||
                  repo.status.deleted.length > 0) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {repo.status.modified.length > 0 && (
                      <Tooltip
                        title={`${repo.status.modified.length} modified file${repo.status.modified.length > 1 ? "s" : ""}`}
                      >
                        <Tag
                          color="orange"
                          style={{
                            fontSize: 11,
                            margin: 0,
                            padding: "0 4px",
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <EditOutlined style={{ fontSize: 10 }} />
                          M: {repo.status.modified.length}
                        </Tag>
                      </Tooltip>
                    )}
                    {repo.status.created.length > 0 && (
                      <Tooltip
                        title={`${repo.status.created.length} added file${repo.status.created.length > 1 ? "s" : ""}`}
                      >
                        <Tag
                          color="green"
                          style={{
                            fontSize: 11,
                            margin: 0,
                            padding: "0 4px",
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <PlusOutlined style={{ fontSize: 10 }} />
                          A: {repo.status.created.length}
                        </Tag>
                      </Tooltip>
                    )}
                    {repo.status.deleted.length > 0 && (
                      <Tooltip
                        title={`${repo.status.deleted.length} deleted file${repo.status.deleted.length > 1 ? "s" : ""}`}
                      >
                        <Tag
                          color="red"
                          style={{
                            fontSize: 11,
                            margin: 0,
                            padding: "0 4px",
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <MinusOutlined style={{ fontSize: 10 }} />
                          D: {repo.status.deleted.length}
                        </Tag>
                      </Tooltip>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <Tooltip
                      title={
                        repo.outgoingCommits > 0
                          ? `${repo.outgoingCommits} outgoing commit${repo.outgoingCommits > 1 ? "s" : ""} (need push)`
                          : "No outgoing commits"
                      }
                    >
                      <div
                        style={statPillStyle(
                          "outgoing",
                          repo.outgoingCommits > 0,
                        )}
                      >
                        <ArrowUpOutlined style={{ fontSize: 10 }} />
                        {repo.outgoingCommits}
                      </div>
                    </Tooltip>
                    {repo.outgoingCommits > 0 && onPushRepo ? (
                      <Tooltip title="Push">
                        <Button
                          size="small"
                          type="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPushRepo(repo.path);
                          }}
                          loading={repoOps[repo.path] === "push"}
                          disabled={!!repoOps[repo.path]}
                          style={{
                            backgroundColor:
                              isDarkMode && !repoOps[repo.path]
                                ? "#52c41a"
                                : undefined,
                            borderColor:
                              isDarkMode && !repoOps[repo.path]
                                ? "#52c41a"
                                : undefined,
                          }}
                        >
                          Push
                        </Button>
                      </Tooltip>
                    ) : null}
                    <Tooltip
                      title={
                        repo.incomingCommits > 0
                          ? `${repo.incomingCommits} incoming commit${repo.incomingCommits > 1 ? "s" : ""} (need pull)`
                          : "No incoming commits"
                      }
                    >
                      <div
                        style={statPillStyle(
                          "incoming",
                          repo.incomingCommits > 0,
                        )}
                      >
                        <ArrowDownOutlined style={{ fontSize: 10 }} />
                        {repo.incomingCommits}
                      </div>
                    </Tooltip>
                    {repo.incomingCommits > 0 && onPullRepo ? (
                      <Tooltip title="Pull">
                        <Button
                          size="small"
                          type="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPullRepo(repo.path);
                          }}
                          loading={repoOps[repo.path] === "pull"}
                          disabled={!!repoOps[repo.path]}
                          style={{
                            backgroundColor:
                              isDarkMode && !repoOps[repo.path]
                                ? "#1890ff"
                                : undefined,
                            borderColor:
                              isDarkMode && !repoOps[repo.path]
                                ? "#1890ff"
                                : undefined,
                          }}
                        >
                          Pull
                        </Button>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {branchSwitcherRepo && (
        <BranchSwitcher
          visible={branchSwitcherVisible}
          repoPath={branchSwitcherRepo}
          currentBranch={getCurrentBranchForSwitcher()}
          onClose={() => {
            setBranchSwitcherVisible(false);
            setBranchSwitcherRepo(null);
          }}
          onBranchSwitch={handleBranchSwitchInternal}
          onStashAndSwitch={
            onStashAndSwitch ? handleStashAndSwitchInternal : undefined
          }
          onDiscardAndSwitch={
            onDiscardAndSwitch ? handleDiscardAndSwitchInternal : undefined
          }
        />
      )}
    </div>
  );
};

export default Sidebar;
