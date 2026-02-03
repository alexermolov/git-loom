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
  Spin,
  Card,
  Descriptions,
  Divider,
  Select,
  Switch,
  Typography,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  CloudDownloadOutlined,
  BranchesOutlined,
  LinkOutlined,
  ClearOutlined,
  CloudUploadOutlined,
} from "@ant-design/icons";
import { useTheme } from "../ThemeContext";
import { RemoteInfo } from "../types";

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

interface RemoteManagementPanelProps {
  repoPath: string | null;
  onRefresh?: () => void;
}

const RemoteManagementPanel: React.FC<RemoteManagementPanelProps> = ({
  repoPath,
  onRefresh,
}) => {
  const { isDarkMode } = useTheme();
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showSetUpstreamModal, setShowSetUpstreamModal] = useState(false);
  
  const [selectedRemote, setSelectedRemote] = useState<RemoteInfo | null>(null);
  const [remoteName, setRemoteName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [newRemoteName, setNewRemoteName] = useState("");
  const [editIsPushUrl, setEditIsPushUrl] = useState(false);
  const [fetchWithPrune, setFetchWithPrune] = useState(false);
  
  const [upstreamRemote, setUpstreamRemote] = useState<string>("");
  const [upstreamBranch, setUpstreamBranch] = useState<string>("");
  const [currentUpstream, setCurrentUpstream] = useState<{ remote: string; branch: string } | null>(null);

  useEffect(() => {
    if (repoPath) {
      loadRemotes();
      loadUpstream();
    }
  }, [repoPath]);

  const loadRemotes = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const remoteList = await window.electronAPI.getRemotes(repoPath);
      setRemotes(remoteList);
    } catch (error: any) {
      message.error(`Failed to load remotes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUpstream = async () => {
    if (!repoPath) return;

    try {
      const upstream = await window.electronAPI.getUpstream(repoPath);
      setCurrentUpstream(upstream);
    } catch (error: any) {
      console.error('Error loading upstream:', error);
    }
  };

  const handleAddRemote = async () => {
    if (!repoPath) return;
    if (!remoteName.trim() || !remoteUrl.trim()) {
      message.warning("Please provide both remote name and URL");
      return;
    }

    setLoading(true);
    try {
      await window.electronAPI.addRemote(repoPath, remoteName.trim(), remoteUrl.trim());
      message.success(`Remote '${remoteName}' added successfully`);
      setRemoteName("");
      setRemoteUrl("");
      setShowAddModal(false);
      await loadRemotes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to add remote: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRemote = async (name: string) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.removeRemote(repoPath, name);
      message.success(`Remote '${name}' removed successfully`);
      await loadRemotes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to remove remote: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameRemote = async () => {
    if (!repoPath || !selectedRemote) return;
    if (!newRemoteName.trim()) {
      message.warning("Please provide a new name");
      return;
    }

    setLoading(true);
    try {
      await window.electronAPI.renameRemote(repoPath, selectedRemote.name, newRemoteName.trim());
      message.success(`Remote renamed to '${newRemoteName}'`);
      setNewRemoteName("");
      setShowRenameModal(false);
      setSelectedRemote(null);
      await loadRemotes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to rename remote: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRemoteUrl = async () => {
    if (!repoPath || !selectedRemote) return;
    if (!remoteUrl.trim()) {
      message.warning("Please provide a URL");
      return;
    }

    setLoading(true);
    try {
      await window.electronAPI.setRemoteUrl(
        repoPath,
        selectedRemote.name,
        remoteUrl.trim(),
        editIsPushUrl
      );
      message.success(`Remote '${selectedRemote.name}' URL updated successfully`);
      setRemoteUrl("");
      setShowEditModal(false);
      setSelectedRemote(null);
      setEditIsPushUrl(false);
      await loadRemotes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to update remote URL: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchRemote = async (name: string) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.fetchRemote(repoPath, name, fetchWithPrune);
      message.success(`Fetched from remote '${name}' successfully`);
      await loadRemotes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to fetch from remote: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePruneRemote = async (name: string) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const prunedBranches = await window.electronAPI.pruneRemote(repoPath, name);
      if (prunedBranches.length > 0) {
        message.success(`Pruned ${prunedBranches.length} stale branch(es) from '${name}'`);
      } else {
        message.info(`No stale branches to prune from '${name}'`);
      }
      await loadRemotes();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to prune remote: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetUpstream = async () => {
    if (!repoPath) return;
    if (!upstreamRemote || !upstreamBranch) {
      message.warning("Please select both remote and branch");
      return;
    }

    setLoading(true);
    try {
      await window.electronAPI.setUpstream(repoPath, upstreamRemote, upstreamBranch);
      message.success(`Upstream set to '${upstreamRemote}/${upstreamBranch}'`);
      setShowSetUpstreamModal(false);
      setUpstreamRemote("");
      setUpstreamBranch("");
      await loadUpstream();
      onRefresh?.();
    } catch (error: any) {
      message.error(`Failed to set upstream: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (remote: RemoteInfo) => {
    setSelectedRemote(remote);
    setRemoteUrl(remote.fetchUrl);
    setEditIsPushUrl(false);
    setShowEditModal(true);
  };

  const openRenameModal = (remote: RemoteInfo) => {
    setSelectedRemote(remote);
    setNewRemoteName(remote.name);
    setShowRenameModal(true);
  };

  const openSetUpstreamModal = () => {
    if (remotes.length === 0) {
      message.warning("No remotes available. Please add a remote first.");
      return;
    }
    if (currentUpstream) {
      setUpstreamRemote(currentUpstream.remote);
      setUpstreamBranch(currentUpstream.branch);
    } else if (remotes.length > 0) {
      setUpstreamRemote(remotes[0].name);
    }
    setShowSetUpstreamModal(true);
  };

  const getAvailableBranches = (): string[] => {
    if (!upstreamRemote) return [];
    const remote = remotes.find(r => r.name === upstreamRemote);
    return remote?.branches || [];
  };

  if (!repoPath) {
    return (
      <div className="remote-management-panel" style={{ padding: 24, textAlign: "center" }}>
        <Empty description="No repository selected" />
      </div>
    );
  }

  return (
    <div className="remote-management-panel" style={{ padding: 16, height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title level={4} style={{ margin: 0 }}>
          Remote Management
        </Title>
        <Space>
          <Tooltip title="Fetch with prune">
            <Switch
              size="small"
              checked={fetchWithPrune}
              onChange={setFetchWithPrune}
              checkedChildren="Prune"
              unCheckedChildren="Prune"
            />
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={loadRemotes} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddModal(true)}>
            Add Remote
          </Button>
        </Space>
      </div>

      {currentUpstream && (
        <Card
          size="small"
          style={{ 
            marginBottom: 16, 
            background: isDarkMode ? "rgba(255, 255, 255, 0.04)" : "#f6f8fa",
            borderColor: isDarkMode ? "rgba(255, 255, 255, 0.12)" : "#d9d9d9"
          }}
          title={
            <Space>
              <CloudUploadOutlined />
              <Text strong>Current Upstream</Text>
            </Space>
          }
          extra={
            <Button size="small" onClick={openSetUpstreamModal}>
              Change
            </Button>
          }
        >
          <Tag color="blue">
            {currentUpstream.remote}/{currentUpstream.branch}
          </Tag>
        </Card>
      )}

      {!currentUpstream && remotes.length > 0 && (
        <Card 
          size="small" 
          style={{ 
            marginBottom: 16, 
            background: isDarkMode ? "rgba(250, 173, 20, 0.1)" : "#fff7e6", 
            borderColor: isDarkMode ? "rgba(250, 173, 20, 0.3)" : "#ffc53d"
          }}
        >
          <Space>
            <Text type="warning">No upstream branch configured.</Text>
            <Button size="small" type="link" onClick={openSetUpstreamModal}>
              Set Upstream
            </Button>
          </Space>
        </Card>
      )}

      <Spin spinning={loading}>
        {remotes.length === 0 ? (
          <Empty
            description="No remotes configured"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 48 }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddModal(true)}>
              Add Your First Remote
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={remotes}
            renderItem={(remote) => (
              <Card
                key={remote.name}
                style={{ 
                  marginBottom: 12,
                  background: isDarkMode ? "rgba(255, 255, 255, 0.02)" : "#fff",
                  borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "#d9d9d9"
                }}
                bodyStyle={{ padding: 16 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Space align="start" size="large">
                      <div>
                        <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                          <LinkOutlined /> {remote.name}
                        </Title>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Fetch URL">
                            <Text code copyable style={{ fontSize: 12 }}>
                              {remote.fetchUrl}
                            </Text>
                          </Descriptions.Item>
                          {remote.pushUrl !== remote.fetchUrl && (
                            <Descriptions.Item label="Push URL">
                              <Text code copyable style={{ fontSize: 12 }}>
                                {remote.pushUrl}
                              </Text>
                            </Descriptions.Item>
                          )}
                        </Descriptions>
                        {remote.branches.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <BranchesOutlined /> {remote.branches.length} remote branch(es)
                            </Text>
                          </div>
                        )}
                      </div>
                    </Space>
                  </div>
                  <Space direction="vertical" size="small">
                    <Button
                      size="small"
                      icon={<CloudDownloadOutlined />}
                      onClick={() => handleFetchRemote(remote.name)}
                      type="primary"
                      ghost
                    >
                      Fetch
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(remote)}
                    >
                      Edit URL
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openRenameModal(remote)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="small"
                      icon={<ClearOutlined />}
                      onClick={() => handlePruneRemote(remote.name)}
                    >
                      Prune
                    </Button>
                    <Popconfirm
                      title={`Remove remote '${remote.name}'?`}
                      description="This will remove the remote configuration. Remote branches will be deleted."
                      onConfirm={() => handleRemoveRemote(remote.name)}
                      okText="Remove"
                      okType="danger"
                      cancelText="Cancel"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>
                        Remove
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            )}
          />
        )}
      </Spin>

      {/* Add Remote Modal */}
      <Modal
        title="Add New Remote"
        open={showAddModal}
        onOk={handleAddRemote}
        onCancel={() => {
          setShowAddModal(false);
          setRemoteName("");
          setRemoteUrl("");
        }}
        okText="Add Remote"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong>Remote Name</Text>
            <Input
              placeholder="e.g., origin, upstream"
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              style={{ marginTop: 8 }}
              autoFocus
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Alphanumeric characters, dots, underscores, and hyphens only
            </Text>
          </div>
          <div>
            <Text strong>Remote URL</Text>
            <TextArea
              placeholder="https://github.com/user/repo.git"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              rows={3}
              style={{ marginTop: 8 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              HTTPS or SSH URL
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Edit Remote URL Modal */}
      <Modal
        title={`Edit Remote '${selectedRemote?.name}'`}
        open={showEditModal}
        onOk={handleEditRemoteUrl}
        onCancel={() => {
          setShowEditModal(false);
          setSelectedRemote(null);
          setRemoteUrl("");
          setEditIsPushUrl(false);
        }}
        okText="Save"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Space>
              <Text strong>URL Type:</Text>
              <Switch
                checked={editIsPushUrl}
                onChange={setEditIsPushUrl}
                checkedChildren="Push"
                unCheckedChildren="Fetch"
              />
            </Space>
          </div>
          <div>
            <Text strong>{editIsPushUrl ? "Push" : "Fetch"} URL</Text>
            <TextArea
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              rows={3}
              style={{ marginTop: 8 }}
              autoFocus
            />
          </div>
        </Space>
      </Modal>

      {/* Rename Remote Modal */}
      <Modal
        title={`Rename Remote '${selectedRemote?.name}'`}
        open={showRenameModal}
        onOk={handleRenameRemote}
        onCancel={() => {
          setShowRenameModal(false);
          setSelectedRemote(null);
          setNewRemoteName("");
        }}
        okText="Rename"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong>New Name</Text>
            <Input
              placeholder="New remote name"
              value={newRemoteName}
              onChange={(e) => setNewRemoteName(e.target.value)}
              style={{ marginTop: 8 }}
              autoFocus
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Alphanumeric characters, dots, underscores, and hyphens only
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Set Upstream Modal */}
      <Modal
        title="Set Upstream Branch"
        open={showSetUpstreamModal}
        onOk={handleSetUpstream}
        onCancel={() => {
          setShowSetUpstreamModal(false);
          setUpstreamRemote("");
          setUpstreamBranch("");
        }}
        okText="Set Upstream"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Paragraph type="secondary">
            Set the upstream branch for the current branch to track changes.
          </Paragraph>
          <div>
            <Text strong>Remote</Text>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              value={upstreamRemote}
              onChange={(value) => {
                setUpstreamRemote(value);
                setUpstreamBranch("");
              }}
              placeholder="Select a remote"
            >
              {remotes.map((remote) => (
                <Option key={remote.name} value={remote.name}>
                  {remote.name}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>Branch</Text>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              value={upstreamBranch}
              onChange={setUpstreamBranch}
              placeholder="Select a branch"
              disabled={!upstreamRemote}
            >
              {getAvailableBranches().map((branch) => (
                <Option key={branch} value={branch}>
                  {branch}
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default RemoteManagementPanel;
