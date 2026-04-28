import React, { useState, useEffect } from "react";
import {
  List,
  Button,
  Input,
  Checkbox,
  Tag,
  Space,
  message,
  App,
  Tooltip,
  Collapse,
  type CollapseProps,
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
  ReloadOutlined,
} from "@ant-design/icons";
import { FileStatus, CommitInfo } from "../types";

interface ChangesPanelProps {
  repoPath: string | null;
  onRefresh?: () => void;
  onFileClick?: (file: FileStatus) => void;
  onHistoryChanged?: () => void;
  onPushRepo?: (repoPath: string) => void;
  pushing?: boolean;
  isActive?: boolean;
}

const ChangesPanel: React.FC<ChangesPanelProps> = ({
  repoPath,
  onRefresh,
  onFileClick,
  onHistoryChanged,
  onPushRepo,
  pushing = false,
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
  const [sourceControlActiveKeys, setSourceControlActiveKeys] =
    useState<string[]>(["changes", "unpushed"]);
  const [changeGroupActiveKeys, setChangeGroupActiveKeys] =
    useState<string[]>(["staged", "unstaged"]);

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

  const normalizeActiveKeys = (keys: string | string[]) =>
    Array.isArray(keys) ? keys : [keys];

  const renderChangeGroupLabel = (
    title: string,
    groupFiles: FileStatus[],
    groupSelected: FileStatus[],
    staged: boolean,
  ) => (
    <div
      className="changes-group-label"
    >
      <Space className="changes-group-title" size="small">
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={
              groupFiles.length > 0 && groupSelected.length === groupFiles.length
            }
            indeterminate={
              groupSelected.length > 0 && groupSelected.length < groupFiles.length
            }
            onChange={(e) => handleSelectAll(staged, e.target.checked)}
          />
        </span>
        <strong style={{ fontSize: "13px" }}>
          {title} ({groupFiles.length})
        </strong>
      </Space>
      {groupSelected.length > 0 && (
        <span
          className="changes-group-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {staged ? (
            <Button
              size="small"
              icon={<MinusOutlined />}
              onClick={() =>
                handleUnstageFiles(groupSelected.map((f) => f.path))
              }
            >
              Unstage ({groupSelected.length})
            </Button>
          ) : (
            <Space size="small" wrap>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  handleStageFiles(groupSelected.map((f) => f.path))
                }
              >
                Stage ({groupSelected.length})
              </Button>
              <Button
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() =>
                  handleDiscardChanges(groupSelected.map((f) => f.path))
                }
              >
                Discard ({groupSelected.length})
              </Button>
            </Space>
          )}
        </span>
      )}
    </div>
  );

  const renderFilesList = (groupFiles: FileStatus[], staged: boolean) => (
    <List
      size="small"
      bordered
      className="changes-list"
      dataSource={groupFiles}
      renderItem={(file) => (
        <List.Item
          className="changes-list-item"
          style={{
            padding: "6px 10px",
            cursor: onFileClick ? "pointer" : "default",
          }}
          onClick={() => onFileClick && onFileClick(file)}
        >
          <div className="changes-file-row">
            <div className="changes-file-main">
              <Checkbox
                checked={selectedFiles.has(file.path)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleSelectFile(file.path, e.target.checked)}
              />
              {getStatusIcon(file.status)}
              <Tooltip title={file.path}>
                <span className="changes-file-path">{file.path}</span>
              </Tooltip>
              {getStatusTag(file.status)}
              {file.oldPath && (
                <Tooltip title={file.oldPath}>
                  <span className="changes-file-old-path">
                    (from {file.oldPath})
                  </span>
                </Tooltip>
              )}
            </div>
            <Space
              className="changes-file-actions"
              size={4}
              onClick={(e) => e.stopPropagation()}
            >
              {staged ? (
                <Button
                  size="small"
                  icon={<MinusOutlined />}
                  title="Unstage"
                  onClick={() => handleUnstageFiles([file.path])}
                />
              ) : (
                <>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    title="Stage"
                    onClick={() => handleStageFiles([file.path])}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<RollbackOutlined />}
                    title="Discard changes"
                    onClick={() => handleDiscardChanges([file.path])}
                  />
                </>
              )}
            </Space>
          </div>
        </List.Item>
      )}
      locale={{ emptyText: staged ? "No staged files" : "No changes" }}
    />
  );

  const changesItems: CollapseProps["items"] = [
    {
      key: "staged",
      label: renderChangeGroupLabel(
        "Staged",
        stagedFiles,
        stagedSelected,
        true,
      ),
      children: renderFilesList(stagedFiles, true),
    },
    {
      key: "unstaged",
      label: renderChangeGroupLabel(
        "Changes",
        unstagedFiles,
        unstagedSelected,
        false,
      ),
      children: renderFilesList(unstagedFiles, false),
    },
  ];

  const sourceControlItems: CollapseProps["items"] = [
    {
      key: "changes",
      label: (
        <Space size="small">
          <span>Changes</span>
          <Tag>{stagedFiles.length + unstagedFiles.length}</Tag>
        </Space>
      ),
      extra: (
        <Tooltip title="Refresh changes">
          <Button
            icon={<ReloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              loadStatus();
            }}
            loading={loading}
            size="small"
          />
        </Tooltip>
      ),
      children: (
        <div className="source-control-section-content source-control-changes-content">
          <Input
            placeholder="Filter files..."
            prefix={<SearchOutlined />}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            allowClear
            size="small"
          />
          <Collapse
            className="changes-nested-collapse"
            activeKey={changeGroupActiveKeys}
            onChange={(keys) =>
              setChangeGroupActiveKeys(normalizeActiveKeys(keys))
            }
            items={changesItems}
            size="small"
          />
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
              style={{ marginBottom: "8px" }}
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
              Commit ({stagedFiles.length} file
              {stagedFiles.length !== 1 ? "s" : ""})
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: "unpushed",
      label: (
        <Space size="small">
          <CloudUploadOutlined />
          <span>Unpushed Commits</span>
          <Tag>{unpushedCommits.length}</Tag>
        </Space>
      ),
      extra: (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          {onPushRepo && (
            <Tooltip title="Push unpushed commits">
              <Button
                type="primary"
                size="small"
                icon={<CloudUploadOutlined />}
                onClick={() => repoPath && onPushRepo(repoPath)}
                loading={pushing}
                disabled={!repoPath || unpushedCommits.length === 0 || pushing}
              >
                Push
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Refresh unpushed commits">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadUnpushedCommits}
              loading={loadingUnpushed}
              size="small"
            />
          </Tooltip>
        </Space>
      ),
      children: (
        <div className="source-control-section-content">
          <List
            size="small"
            bordered
            dataSource={unpushedCommits}
            loading={loadingUnpushed}
            renderItem={(commit) => (
              <List.Item
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "8px 12px",
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
      ),
    },
  ];

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
      <Collapse
        className="source-control-collapse"
        activeKey={sourceControlActiveKeys}
        onChange={(keys) =>
          setSourceControlActiveKeys(normalizeActiveKeys(keys))
        }
        items={sourceControlItems}
        size="small"
      />
    </div>
  );
};

export default ChangesPanel;
