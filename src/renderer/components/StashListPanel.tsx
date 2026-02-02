import React, { useState, useEffect } from "react";
import {
  List,
  Button,
  Input,
  Modal,
  message,
  Tooltip,
  Popconfirm,
  Space,
  Tag,
  Empty,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  ClearOutlined,
  ImportOutlined,
  ExportOutlined,
  BranchesOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { StashEntry } from "../types";

const { TextArea } = Input;

interface StashListPanelProps {
  repoPath: string | null;
  onRefresh?: () => void;
  onStashSelect?: (stash: StashEntry) => void;
  selectedStashIndex?: number | null;
}

const StashListPanel: React.FC<StashListPanelProps> = ({
  repoPath,
  onRefresh,
  onStashSelect,
  selectedStashIndex,
}) => {
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [stashMessage, setStashMessage] = useState("");
  const [branchName, setBranchName] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [selectedStashForBranch, setSelectedStashForBranch] = useState<StashEntry | null>(null);

  useEffect(() => {
    if (repoPath) {
      loadStashes();
    }
  }, [repoPath]);

  const loadStashes = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const stashList = await window.electronAPI.getStashList(repoPath);
      setStashes(stashList);
    } catch (error: any) {
      message.error(`Failed to load stashes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStash = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.createStash(
        repoPath,
        stashMessage || undefined,
        includeUntracked,
      );
      message.success("Stash created successfully");
      setStashMessage("");
      setIncludeUntracked(false);
      setShowCreateModal(false);
      await loadStashes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to create stash: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyStash = async (index: number) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.applyStash(repoPath, index);
      message.success("Stash applied successfully");
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to apply stash: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePopStash = async (index: number) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.popStash(repoPath, index);
      message.success("Stash popped successfully");
      await loadStashes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to pop stash: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDropStash = async (index: number) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.dropStash(repoPath, index);
      message.success("Stash dropped successfully");
      await loadStashes();
    } catch (error: any) {
      message.error(`Failed to drop stash: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!repoPath || !selectedStashForBranch || !branchName.trim()) return;

    setLoading(true);
    try {
      await window.electronAPI.createBranchFromStash(
        repoPath,
        selectedStashForBranch.index,
        branchName.trim(),
      );
      message.success(`Branch "${branchName}" created from stash`);
      setBranchName("");
      setShowBranchModal(false);
      setSelectedStashForBranch(null);
      await loadStashes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to create branch: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllStashes = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.clearAllStashes(repoPath);
      message.success("All stashes cleared");
      await loadStashes();
    } catch (error: any) {
      message.error(`Failed to clear stashes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const renderStashItem = (stash: StashEntry) => {
    const isSelected = selectedStashIndex === stash.index;

    return (
      <List.Item
        key={stash.index}
        className={`stash-item ${isSelected ? "selected" : ""}`}
        onClick={() => onStashSelect?.(stash)}
        style={{
          cursor: "pointer",
          backgroundColor: isSelected ? "var(--hover-bg)" : "transparent",
          padding: "12px 16px",
        }}
      >
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <Tag color="blue">stash@{"{" + stash.index + "}"}</Tag>
                <Tag color="green">{stash.branch}</Tag>
                <span
                  style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                >
                  {formatDate(stash.date)}
                </span>
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                {stash.message}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                by {stash.author} • {stash.hash.substring(0, 7)}
              </div>
            </div>
          </div>

          {isSelected && (
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <Tooltip title="Apply stash (keep in list)">
                <Button
                  size="small"
                  icon={<ImportOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApplyStash(stash.index);
                  }}
                >
                  Apply
                </Button>
              </Tooltip>

              <Tooltip title="Pop stash (apply and remove)">
                <Button
                  size="small"
                  icon={<ExportOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePopStash(stash.index);
                  }}
                >
                  Pop
                </Button>
              </Tooltip>

              <Tooltip title="Create branch from stash">
                <Button
                  size="small"
                  icon={<BranchesOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStashForBranch(stash);
                    setShowBranchModal(true);
                  }}
                >
                  Branch
                </Button>
              </Tooltip>

              <Popconfirm
                title="Drop this stash?"
                description="This action cannot be undone."
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDropStash(stash.index);
                }}
                okText="Drop"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                >
                  Drop
                </Button>
              </Popconfirm>
            </div>
          )}
        </div>
      </List.Item>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600 }}>
          {stashes.length} stash{stashes.length !== 1 ? "es" : ""}
        </span>
        <Space>
          <Tooltip title="Create new stash">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
              disabled={!repoPath}
            >
              New
            </Button>
          </Tooltip>

          <Tooltip title="Refresh stashes">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadStashes}
              loading={loading}
              disabled={!repoPath}
            />
          </Tooltip>

          {stashes.length > 0 && (
            <Popconfirm
              title="Clear all stashes?"
              description="This will permanently delete all stashes."
              onConfirm={handleClearAllStashes}
              okText="Clear All"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Clear all stashes">
                <Button
                  size="small"
                  danger
                  icon={<ClearOutlined />}
                  disabled={!repoPath}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {stashes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No stashes"
            style={{ marginTop: "60px" }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
              disabled={!repoPath}
            >
              Create Stash
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={stashes}
            renderItem={renderStashItem}
            loading={loading}
          />
        )}
      </div>

      {/* Create Stash Modal */}
      <Modal
        title="Create Stash"
        open={showCreateModal}
        onOk={handleCreateStash}
        onCancel={() => {
          setShowCreateModal(false);
          setStashMessage("");
          setIncludeUntracked(false);
        }}
        okText="Create"
        confirmLoading={loading}
      >
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}
          >
            Stash Message (optional):
          </label>
          <TextArea
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            placeholder="Enter a message to describe this stash"
            rows={3}
            maxLength={200}
          />
        </div>

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeUntracked}
              onChange={(e) => setIncludeUntracked(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Include untracked files
          </label>
        </div>
      </Modal>

      {/* Create Branch Modal */}
      <Modal
        title="Create Branch from Stash"
        open={showBranchModal}
        onOk={handleCreateBranch}
        onCancel={() => {
          setShowBranchModal(false);
          setBranchName("");
          setSelectedStashForBranch(null);
        }}
        okText="Create Branch"
        confirmLoading={loading}
      >
        <div>
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}
          >
            Branch Name:
          </label>
          <Input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="feature/my-branch"
            onPressEnter={handleCreateBranch}
          />
          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            This will create a new branch and apply the stash to it.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StashListPanel;
