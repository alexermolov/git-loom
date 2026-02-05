import React, { useState, useEffect } from "react";
import {
  List,
  Button,
  Input,
  Checkbox,
  Tag,
  Space,
  Divider,
  message,
  Modal,
  App,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  MinusOutlined,
  FileAddOutlined,
  FileOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  CheckOutlined,
  SearchOutlined,
  RollbackOutlined,
  CloudUploadOutlined,
} from "@ant-design/icons";
import { FileStatus, CommitInfo } from "../types";

const { TextArea } = Input;

interface ChangesPanelProps {
  repoPath: string | null;
  onRefresh?: () => void;
  onFileClick?: (file: FileStatus) => void;
  onHistoryChanged?: () => void;
  isActive?: boolean;
}

const ChangesPanel: React.FC<ChangesPanelProps> = ({
  repoPath,
  onRefresh,
  onFileClick,
  onHistoryChanged,
  isActive = true,
}) => {
  const { modal } = App.useApp();
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [unpushedCommits, setUnpushedCommits] = useState<CommitInfo[]>([]);
  const [loadingUnpushed, setLoadingUnpushed] = useState(false);

  // Initial load when repoPath changes
  useEffect(() => {
    if (repoPath) {
      loadStatus();
      loadUnpushedCommits();
    }
  }, [repoPath]);

  // Auto-refresh when panel becomes active
  useEffect(() => {
    if (isActive && repoPath) {
      loadStatus();
      loadUnpushedCommits();
    }
  }, [isActive]);

  // Periodic auto-refresh (every 10 seconds)
  useEffect(() => {
    if (!repoPath || !isActive) return;

    const interval = setInterval(() => {
      loadStatus();
      loadUnpushedCommits();
    }, 10000); // 30 seconds

    return () => clearInterval(interval);
  }, [repoPath, isActive]);

  const loadStatus = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const status = await window.electronAPI.getStatus(repoPath);
      setFiles(status);
    } catch (error) {
      console.error("Error loading status:", error);
      message.error("Failed to load file status");
    } finally {
      setLoading(false);
    }
  };

  const loadUnpushedCommits = async () => {
    if (!repoPath) return;

    setLoadingUnpushed(true);
    try {
      const commits = await window.electronAPI.getUnpushedCommits(repoPath);
      setUnpushedCommits(commits);
    } catch (error) {
      console.error("Error loading unpushed commits:", error);
    } finally {
      setLoadingUnpushed(false);
    }
  };

  const handleStageFiles = async (filePaths: string[]) => {
    if (!repoPath) return;

    try {
      await window.electronAPI.stageFiles(repoPath, filePaths);
      message.success(`Staged ${filePaths.length} file(s)`);
      await loadStatus();
      setSelectedFiles(new Set());
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error staging files:", error);
      message.error("Failed to stage files");
    }
  };

  const handleUnstageFiles = async (filePaths: string[]) => {
    if (!repoPath) return;

    try {
      await window.electronAPI.unstageFiles(repoPath, filePaths);
      message.success(`Unstaged ${filePaths.length} file(s)`);
      await loadStatus();
      setSelectedFiles(new Set());
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error unstaging files:", error);
      message.error("Failed to unstage files");
    }
  };

  const handleDiscardChanges = async (filePaths: string[]) => {
    if (!repoPath) return;

    modal.confirm({
      title: "Discard Changes",
      content: `Are you sure you want to discard changes in ${filePaths.length} file(s)? This action cannot be undone.`,
      okText: "Discard",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await window.electronAPI.discardChanges(repoPath, filePaths);
          message.success(`Discarded changes in ${filePaths.length} file(s)`);
          await loadStatus();
          setSelectedFiles(new Set());
          if (onRefresh) onRefresh();
        } catch (error) {
          console.error("Error discarding changes:", error);
          message.error("Failed to discard changes");
        }
      },
    });
  };

  const handleCommit = async () => {
    if (!repoPath) return;
    if (!commitMessage.trim()) {
      message.warning("Please enter a commit message");
      return;
    }

    const stagedFiles = files.filter((f) => f.staged);
    if (stagedFiles.length === 0) {
      message.warning("No files staged for commit");
      return;
    }

    try {
      await window.electronAPI.createCommit(repoPath, commitMessage);
      message.success("Commit created successfully");
      setCommitMessage("");
      await loadStatus();
      await loadUnpushedCommits();
      if (onRefresh) onRefresh();
      if (onHistoryChanged) onHistoryChanged();
    } catch (error) {
      console.error("Error creating commit:", error);
      message.error("Failed to create commit");
    }
  };

  const handleSelectFile = (filePath: string, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(filePath);
    } else {
      newSelected.delete(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = (staged: boolean, checked: boolean) => {
    const filesToSelect = files.filter((f) => f.staged === staged);
    const newSelected = new Set(selectedFiles);

    if (checked) {
      filesToSelect.forEach((f) => newSelected.add(f.path));
    } else {
      filesToSelect.forEach((f) => newSelected.delete(f.path));
    }

    setSelectedFiles(newSelected);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
      case "untracked":
        return <FileAddOutlined style={{ color: "#52c41a" }} />;
      case "modified":
        return <EditOutlined style={{ color: "#1890ff" }} />;
      case "deleted":
        return <DeleteOutlined style={{ color: "#ff4d4f" }} />;
      case "renamed":
        return <SwapOutlined style={{ color: "#722ed1" }} />;
      default:
        return <FileOutlined />;
    }
  };

  const getStatusTag = (status: string) => {
    const colors: Record<string, string> = {
      added: "success",
      untracked: "success",
      modified: "processing",
      deleted: "error",
      renamed: "purple",
    };
    return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
  };

  // Filter files based on search text
  const filterFiles = (fileList: FileStatus[]) => {
    if (!filterText.trim()) return fileList;
    const query = filterText.toLowerCase();
    return fileList.filter(
      (f) =>
        f.path.toLowerCase().includes(query) ||
        f.status.toLowerCase().includes(query),
    );
  };

  const unstagedFiles = filterFiles(files.filter((f) => !f.staged));
  const stagedFiles = filterFiles(files.filter((f) => f.staged));
  const unstagedSelected = unstagedFiles.filter((f) =>
    selectedFiles.has(f.path),
  );
  const stagedSelected = stagedFiles.filter((f) => selectedFiles.has(f.path));

  return (
    <div
      className="changes-panel"
      style={{
        padding: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Half - Changes Section */}
      <div
        style={{
          flex: "1 1 50%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px" }}>Changes</h3>
          <Button onClick={loadStatus} loading={loading} size="small">
            Refresh
          </Button>
        </div>

        <Input
          placeholder="Filter files..."
          prefix={<SearchOutlined />}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          allowClear
          size="small"
          style={{ marginBottom: 12 }}
        />

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {/* Staged Files */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                padding: "4px 8px",
                backgroundColor: "var(--bg-hover)",
                borderRadius: "4px",
              }}
            >
              <Space size="small">
                <Checkbox
                  checked={
                    stagedFiles.length > 0 &&
                    stagedSelected.length === stagedFiles.length
                  }
                  indeterminate={
                    stagedSelected.length > 0 &&
                    stagedSelected.length < stagedFiles.length
                  }
                  onChange={(e) => handleSelectAll(true, e.target.checked)}
                />
                <strong style={{ fontSize: "13px" }}>
                  Staged Changes ({stagedFiles.length})
                </strong>
              </Space>
              {stagedSelected.length > 0 && (
                <Button
                  size="small"
                  icon={<MinusOutlined />}
                  onClick={() =>
                    handleUnstageFiles(stagedSelected.map((f) => f.path))
                  }
                >
                  Unstage Selected ({stagedSelected.length})
                </Button>
              )}
            </div>
            <List
              size="small"
              bordered
              className="changes-list"
              dataSource={stagedFiles}
              renderItem={(file) => (
                <List.Item
                  className="changes-list-item"
                  style={{
                    padding: "6px 10px",
                    cursor: onFileClick ? "pointer" : "default",
                  }}
                  onClick={() => onFileClick && onFileClick(file)}
                  actions={[
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      title="Unstage"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnstageFiles([file.path]);
                      }}
                    />,
                  ]}
                >
                  <Space size="small">
                    <Checkbox
                      checked={selectedFiles.has(file.path)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectFile(file.path, e.target.checked);
                      }}
                    />
                    {getStatusIcon(file.status)}
                    <span style={{ fontSize: "13px" }}>{file.path}</span>
                    {getStatusTag(file.status)}
                    {file.oldPath && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        (from {file.oldPath})
                      </span>
                    )}
                  </Space>
                </List.Item>
              )}
              locale={{ emptyText: "No staged files" }}
            />
          </div>

          <Divider style={{ margin: "12px 0" }} />

          {/* Unstaged Files */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                padding: "4px 8px",
                backgroundColor: "var(--bg-hover)",
                borderRadius: "4px",
              }}
            >
              <Space size="small">
                <Checkbox
                  checked={
                    unstagedFiles.length > 0 &&
                    unstagedSelected.length === unstagedFiles.length
                  }
                  indeterminate={
                    unstagedSelected.length > 0 &&
                    unstagedSelected.length < unstagedFiles.length
                  }
                  onChange={(e) => handleSelectAll(false, e.target.checked)}
                />
                <strong style={{ fontSize: "13px" }}>
                  Changes ({unstagedFiles.length})
                </strong>
              </Space>
              {unstagedSelected.length > 0 && (
                <Space size="small">
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() =>
                      handleStageFiles(unstagedSelected.map((f) => f.path))
                    }
                  >
                    Stage ({unstagedSelected.length})
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<RollbackOutlined />}
                    onClick={() =>
                      handleDiscardChanges(unstagedSelected.map((f) => f.path))
                    }
                  >
                    Discard ({unstagedSelected.length})
                  </Button>
                </Space>
              )}
            </div>
            <List
              size="small"
              bordered
              className="changes-list"
              dataSource={unstagedFiles}
              renderItem={(file) => (
                <List.Item
                  className="changes-list-item"
                  style={{
                    padding: "6px 10px",
                    cursor: onFileClick ? "pointer" : "default",
                  }}
                  onClick={() => onFileClick && onFileClick(file)}
                  actions={[
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      title="Stage"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStageFiles([file.path]);
                      }}
                    />,
                    <Button
                      size="small"
                      danger
                      icon={<RollbackOutlined />}
                      title="Discard changes"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDiscardChanges([file.path]);
                      }}
                    />,
                  ]}
                >
                  <Space size="small">
                    <Checkbox
                      checked={selectedFiles.has(file.path)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectFile(file.path, e.target.checked);
                      }}
                    />
                    {getStatusIcon(file.status)}
                    <span style={{ fontSize: "13px" }}>{file.path}</span>
                    {getStatusTag(file.status)}
                  </Space>
                </List.Item>
              )}
              locale={{ emptyText: "No changes" }}
            />
          </div>
        </div>
      </div>

      {/* Commit Section */}
      <div
        className="commit-section"
        style={{
          borderTop: "1px solid var(--border-color)",
          borderBottom: "1px solid var(--border-color)",
          padding: "12px",
          borderRadius: "4px",
          backgroundColor: "var(--bg-hover)",
        }}
      >
        <Input
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          style={{
            marginBottom: "8px",
          }}
          onPressEnter={handleCommit}
        />
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={handleCommit}
          disabled={stagedFiles.length === 0 || !commitMessage.trim()}
          size="small"
          block
        >
          Commit ({stagedFiles.length} file{stagedFiles.length !== 1 ? "s" : ""}
          )
        </Button>
      </div>

      {/* Bottom Half - Unpushed Commits Section */}
      <div
        style={{
          flex: "1 1 50%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          marginTop: "8px",
        }}
      >
        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            <CloudUploadOutlined style={{ marginRight: "6px" }} />
            Unpushed Commits ({unpushedCommits.length})
          </h3>
          <Button
            onClick={loadUnpushedCommits}
            loading={loadingUnpushed}
            size="small"
          >
            Refresh
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <List
            size="small"
            bordered
            dataSource={unpushedCommits}
            loading={loadingUnpushed}
            renderItem={(commit) => (
              <List.Item
                style={{
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: "100%" }}>
                  <Tooltip title={commit.hash}>
                    <Tag
                      color="orange"
                      style={{ fontSize: "11px", fontFamily: "monospace" }}
                    >
                      {commit.hash.substring(0, 7)}
                    </Tag>
                  </Tooltip>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      marginLeft: "8px",
                    }}
                  >
                    {commit.message}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-tertiary)",
                    marginTop: "4px",
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <span>{commit.author}</span>
                  <span>{new Date(commit.date).toLocaleString()}</span>
                </div>
              </List.Item>
            )}
            locale={{ emptyText: "No unpushed commits" }}
          />
        </div>
      </div>
    </div>
  );
};

export default ChangesPanel;
