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
  Radio,
  Select,
  Typography,
  Divider,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  TagOutlined,
  TagsOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { TagInfo } from "../types";

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

interface TagsPanelProps {
  repoPath: string | null;
  onRefresh?: () => void;
  isDarkTheme?: boolean;
}

const TagsPanel: React.FC<TagsPanelProps> = ({
  repoPath,
  onRefresh,
  isDarkTheme = false,
}) => {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [filteredTags, setFilteredTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showDeleteRemoteModal, setShowDeleteRemoteModal] = useState(false);
  
  // Form states
  const [tagType, setTagType] = useState<"lightweight" | "annotated">("lightweight");
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [selectedTag, setSelectedTag] = useState<TagInfo | null>(null);
  const [remoteName, setRemoteName] = useState("origin");
  const [remotes, setRemotes] = useState<string[]>([]);
  const [pushAllTags, setPushAllTags] = useState(false);

  useEffect(() => {
    if (repoPath) {
      loadTags();
      loadRemotes();
    }
  }, [repoPath]);

  useEffect(() => {
    filterTags();
  }, [searchQuery, tags]);

  const loadTags = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const tagList = await window.electronAPI.getTags(repoPath);
      setTags(tagList);
      setFilteredTags(tagList);
    } catch (error: any) {
      message.error(`Failed to load tags: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadRemotes = async () => {
    if (!repoPath) return;

    try {
      const remoteList = await window.electronAPI.getRemotes(repoPath);
      setRemotes(remoteList.map(r => r.name));
      if (remoteList.length > 0) {
        setRemoteName(remoteList[0].name);
      }
    } catch (error: any) {
      console.error('Error loading remotes:', error);
    }
  };

  const filterTags = () => {
    if (!searchQuery.trim()) {
      setFilteredTags(tags);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tags.filter(tag => 
      tag.name.toLowerCase().includes(query) ||
      tag.commitHash.toLowerCase().includes(query) ||
      tag.message?.toLowerCase().includes(query) ||
      tag.tagger?.toLowerCase().includes(query)
    );
    setFilteredTags(filtered);
  };

  const handleCreateTag = async () => {
    if (!repoPath) return;

    if (!tagName.trim()) {
      message.error("Tag name is required");
      return;
    }

    if (tagType === "annotated" && !tagMessage.trim()) {
      message.error("Annotated tags require a message");
      return;
    }

    setLoading(true);
    try {
      if (tagType === "lightweight") {
        await window.electronAPI.createLightweightTag(
          repoPath,
          tagName,
          commitHash || undefined
        );
        message.success(`Lightweight tag '${tagName}' created successfully`);
      } else {
        await window.electronAPI.createAnnotatedTag(
          repoPath,
          tagName,
          tagMessage,
          commitHash || undefined
        );
        message.success(`Annotated tag '${tagName}' created successfully`);
      }

      await loadTags();
      setShowCreateModal(false);
      resetCreateForm();
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      message.error(`Failed to create tag: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tag: TagInfo) => {
    if (!repoPath) return;

    setLoading(true);
    try {
      await window.electronAPI.deleteTag(repoPath, tag.name);
      message.success(`Tag '${tag.name}' deleted locally`);
      await loadTags();
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      message.error(`Failed to delete tag: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRemoteTag = async () => {
    if (!repoPath || !selectedTag) return;

    setLoading(true);
    try {
      await window.electronAPI.deleteRemoteTag(repoPath, remoteName, selectedTag.name);
      message.success(`Tag '${selectedTag.name}' deleted from remote '${remoteName}'`);
      setShowDeleteRemoteModal(false);
      setSelectedTag(null);
    } catch (error: any) {
      message.error(`Failed to delete remote tag: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePushTags = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      if (pushAllTags) {
        await window.electronAPI.pushTags(repoPath, remoteName);
        message.success(`All tags pushed to '${remoteName}'`);
      } else if (selectedTag) {
        await window.electronAPI.pushTags(repoPath, remoteName, selectedTag.name);
        message.success(`Tag '${selectedTag.name}' pushed to '${remoteName}'`);
      }

      setShowPushModal(false);
      setSelectedTag(null);
      setPushAllTags(false);
    } catch (error: any) {
      message.error(`Failed to push tags: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutTag = async (tag: TagInfo) => {
    if (!repoPath) return;

    Modal.confirm({
      title: "Checkout Tag (Detached HEAD)",
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Paragraph>
            You are about to checkout tag <Text strong>{tag.name}</Text>.
          </Paragraph>
          <Paragraph type="warning">
            This will put your repository in a <Text strong>"detached HEAD"</Text> state.
            Any commits made in this state will not belong to any branch and may be lost.
          </Paragraph>
          <Paragraph>
            To create a new branch from this tag, use: <Text code>git checkout -b branch-name {tag.name}</Text>
          </Paragraph>
        </div>
      ),
      okText: "Checkout",
      okType: "primary",
      cancelText: "Cancel",
      onOk: async () => {
        setLoading(true);
        try {
          await window.electronAPI.checkoutTag(repoPath, tag.name);
          message.success(`Checked out tag '${tag.name}' (detached HEAD)`);
          
          if (onRefresh) {
            onRefresh();
          }
        } catch (error: any) {
          message.error(`Failed to checkout tag: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleViewDetails = (tag: TagInfo) => {
    setSelectedTag(tag);
    setShowDetailsModal(true);
  };

  const resetCreateForm = () => {
    setTagName("");
    setTagMessage("");
    setCommitHash("");
    setTagType("lightweight");
  };

  const handleRefresh = async () => {
    await loadTags();
    message.success("Tags refreshed");
  };

  const openPushModal = (tag?: TagInfo) => {
    if (tag) {
      setSelectedTag(tag);
      setPushAllTags(false);
    } else {
      setSelectedTag(null);
      setPushAllTags(true);
    }
    setShowPushModal(true);
  };

  const openDeleteRemoteModal = (tag: TagInfo) => {
    setSelectedTag(tag);
    setShowDeleteRemoteModal(true);
  };

  return (
    <div style={{ 
      padding: "16px", 
      height: "100%", 
      overflow: "auto",
      backgroundColor: isDarkTheme ? '#1f1f1f' : '#ffffff',
    }}>
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
        <Input
          placeholder="Search tags by name, hash, message, or author..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowCreateModal(true)}
          disabled={!repoPath}
        >
          New Tag
        </Button>
        <Tooltip title="Push All Tags">
          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => openPushModal()}
            disabled={!repoPath || tags.length === 0 || remotes.length === 0}
          >
            Push All
          </Button>
        </Tooltip>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} disabled={!repoPath} />
        </Tooltip>
      </div>

      {!repoPath ? (
        <Empty description="No repository selected" />
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Spin size="large" />
        </div>
      ) : filteredTags.length === 0 ? (
        <Empty
          description={
            searchQuery ? `No tags matching "${searchQuery}"` : "No tags found"
          }
        />
      ) : (
        <List
          dataSource={filteredTags}
          renderItem={(tag) => (
            <Card
              size="small"
              style={{ 
                marginBottom: "8px",
                backgroundColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkTheme ? '#3a3a3a' : '#d9d9d9',
              }}
              hoverable
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>isDarkTheme ? "#4a9eff" : "#1890ff" }} />
                      ) : (
                        <TagOutlined style={{ color: isDarkTheme ? "#73d13d" alignItems: "center", gap: "8px" }}>
                      {tag.type === "annotated" ? (
                        <TagsOutlined style={{ color: "#1890ff" }} />
                      ) : (
                        <TagOutlined style={{ color: "#52c41a" }} />
                      )}
                      <Text strong style={{ fontSize: "16px" }}>
                        {tag.name}
                      </Text>
                      <Tag color={tag.type === "annotated" ? "blue" : "green"}>
                        {tag.type}
                      </Tag>
                    </div>
                    
                    <div>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        Commit: <Text code>{tag.commitHash.substring(0, 7)}</Text>
                      </Text>
                    </div>

                    {tag.message && (
                      <div>
                        <Text style={{ fontSize: "13px" }}>{tag.message}</Text>
                      </div>
                    )}

                    {tag.tagger && (
                      <div>
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          By {tag.tagger}
                          {tag.date && ` on ${new Date(tag.date).toLocaleString()}`}
                        </Text>
                      </div>
                    )}
                  </Space>
                </div>

                <Space>
                  <Tooltip title="View Details">
                    <Button
                      size="small"
                      icon={<InfoCircleOutlined />}
                      onClick={() => handleViewDetails(tag)}
                    />
                  </Tooltip>
                  <Tooltip title="Checkout Tag">
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleCheckoutTag(tag)}
                    />
                  </Tooltip>
                  <Tooltip title="Push to Remote">
                    <Button
                      size="small"
                      icon={<CloudUploadOutlined />}
                      onClick={() => openPushModal(tag)}
                      disabled={remotes.length === 0}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="Delete Local Tag"
                    description={`Are you sure you want to delete tag '${tag.name}' locally?`}
                    onConfirm={() => handleDeleteTag(tag)}
                    okText="Delete"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                  >
                    <Tooltip title="Delete Local Tag">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                  <Tooltip title="Delete Remote Tag">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => openDeleteRemoteModal(tag)}
                      disabled={remotes.length === 0}
                    >
                      Remote
                    </Button>
                  </Tooltip>
                </Space>
              </div>
            </Card>
          )}
        />
      )}

      {/* Create Tag Modal */}
      <Modal
        title="Create New Tag"
        open={showCreateModal}
        onOk={handleCreateTag}
        onCancel={() => {
          setShowCreateModal(false);
          resetCreateForm();
        styles={{
          body: { backgroundColor: isDarkTheme ? '#1f1f1f' : '#ffffff' },
        }}
        }}
        okText="Create"
        cancelText="Cancel"
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Text>Tag Type:</Text>
            <Radio.Group
              value={tagType}
              onChange={(e) => setTagType(e.target.value)}
              style={{ marginTop: "8px", width: "100%" }}
            >
              <Radio value="lightweight">
                <Space>
                  <TagOutlined />
                  Lightweight
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    (Simple pointer to a commit)
                  </Text>
                </Space>
              </Radio>
              <Radio value="annotated">
                <Space>
                  <TagsOutlined />
                  Annotated
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    (Full object with message and metadata)
                  </Text>
                </Space>
              </Radio>
            </Radio.Group>
          </div>

          <div>
            <Text>Tag Name: <Text type="danger">*</Text></Text>
            <Input
              placeholder="v1.0.0"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              style={{ marginTop: "8px" }}
            />
          </div>

          {tagType === "annotated" && (
            <div>
              <Text>Message: <Text type="danger">*</Text></Text>
              <TextArea
                placeholder="Release version 1.0.0"
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                rows={4}
                style={{ marginTop: "8px" }}
              />
            </div>
          )}

          <div>
            <Text>Commit Hash (optional):</Text>
            <Input
              placeholder="Leave empty to tag HEAD"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
              style={{ marginTop: "8px" }}
            />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              If not specified, the tag will be created at the current HEAD
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Tag Details Modal */}
      <Modal
        title="Tag Details"
        open={showDetailsModal}
        onCancel={() => {
          setShowDetailsModal(false);
          setSelectedTag(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
        styles={{
          body: { backgroundColor: isDarkTheme ? '#1f1f1f' : '#ffffff' },
        }}
            setShowDetailsModal(false);
            setSelectedTag(null);
          }}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedTag && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Name">
              <Text strong>{selectedTag.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item
                  margin: 0, 
                  whiteSpace: "pre-wrap",
                  backgroundColor: isDarkTheme ? '#2a2a2a' : '#fafafa',
                  color: isDarkTheme ? '#e0e0e0' : '#000000',
                  padding: '8px',
                  borderRadius: '4px',
               
              <Tag color={selectedTag.type === "annotated" ? "blue" : "green"}>
                {selectedTag.type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Commit Hash">
              <Text code>{selectedTag.commitHash}</Text>
            </Descriptions.Item>
            {selectedTag.message && (
              <Descriptions.Item label="Message">
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {selectedTag.message}
                </pre>
              </Descriptions.Item>
            )}
            {selectedTag.tagger && (
              <Descriptions.Item label="Tagger">
                {selectedTag.tagger}
              </Descriptions.Item>
            )}
            {selectedTag.date && (
              <Descriptions.Item label="Date">
                {new Date(selectedTag.date).toLocaleString()}
              </Descriptions.Item>
        styles={{
          body: { backgroundColor: isDarkTheme ? '#1f1f1f' : '#ffffff' },
        }}
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Push Tags Modal */}
      <Modal
        title="Push Tags to Remote"
        open={showPushModal}
        onOk={handlePushTags}
        onCancel={() => {
          setShowPushModal(false);
          setSelectedTag(null);
          setPushAllTags(false);
        }}
        okText="Push"
        cancelText="Cancel"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {pushAllTags ? (
            <Paragraph>
              Push <Text strong>all tags</Text> to remote <Text strong>{remoteName}</Text>?
            </Paragraph>
          ) : (
            <Paragraph>
              Push tag <Text strong>{selectedTag?.name}</Text> to remote <Text strong>{remoteName}</Text>?
            </Paragraph>
          )}

          <div>
            <Text>Remote:</Text>
            <Select
              value={remoteName}
              onChange={setRemoteName}
              style={{ width: "100%", marginTop: "8px" }}
            >
              {remotes.map((remote) => (
                <Option key={remote} value={remote}>
        styles={{
          body: { backgroundColor: isDarkTheme ? '#1f1f1f' : '#ffffff' },
        }}
                  {remote}
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>

      {/* Delete Remote Tag Modal */}
      <Modal
        title="Delete Remote Tag"
        open={showDeleteRemoteModal}
        onOk={handleDeleteRemoteTag}
        onCancel={() => {
          setShowDeleteRemoteModal(false);
          setSelectedTag(null);
        }}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Paragraph type="danger">
            <ExclamationCircleOutlined /> This will delete tag <Text strong>{selectedTag?.name}</Text> from the remote repository.
          </Paragraph>
          <Paragraph>
            This action cannot be undone. The local tag will remain intact.
          </Paragraph>

          <div>
            <Text>Remote:</Text>
            <Select
              value={remoteName}
              onChange={setRemoteName}
              style={{ width: "100%", marginTop: "8px" }}
            >
              {remotes.map((remote) => (
                <Option key={remote} value={remote}>
                  {remote}
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default TagsPanel;
