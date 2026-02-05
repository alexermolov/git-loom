import React, { useState, useEffect } from "react";
import {
  Button,
  Select,
  Modal,
  message,
  Space,
  Tag,
  Empty,
  Alert,
  Tooltip,
  Input,
  Card,
  Divider,
  Typography,
} from "antd";
import {
  BranchesOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  MergeCellsOutlined,
  DragOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  FastForwardOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { BranchInfo, RebasePlan, RebaseCommit, RebaseStatus } from "../types";
import ConflictResolutionPanel from "./ConflictResolutionPanel";

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

interface InteractiveRebasePanelProps {
  repoPath: string | null;
  branches: BranchInfo[];
  currentBranch: string;
  onRefresh?: () => void;
}

const InteractiveRebasePanel: React.FC<InteractiveRebasePanelProps> = ({
  repoPath,
  branches,
  currentBranch,
  onRefresh,
}) => {
  const [targetBranch, setTargetBranch] = useState<string>("");
  const [rebasePlan, setRebasePlan] = useState<RebasePlan | null>(null);
  const [commits, setCommits] = useState<RebaseCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showEditMessageModal, setShowEditMessageModal] = useState(false);
  const [editingCommit, setEditingCommit] = useState<RebaseCommit | null>(null);
  const [newCommitMessage, setNewCommitMessage] = useState("");
  const [showConflictResolution, setShowConflictResolution] = useState(false);

  useEffect(() => {
    if (repoPath) {
      checkRebaseStatus();
    }
  }, [repoPath]);

  useEffect(() => {
    // Auto-refresh status every 2 seconds if rebase is in progress
    if (rebaseStatus?.inProgress) {
      const interval = setInterval(() => {
        checkRebaseStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [rebaseStatus?.inProgress]);

  const checkRebaseStatus = async () => {
    if (!repoPath) return;

    try {
      const status = await window.electronAPI.getRebaseStatus(repoPath);
      setRebaseStatus(status);

      if (status.hasConflicts) {
        setShowConflictResolution(true);
      }
    } catch (error: any) {
      console.error("Error checking rebase status:", error);
    }
  };

  const loadRebasePlan = async () => {
    if (!repoPath || !targetBranch) {
      message.warning("Please select a target branch");
      return;
    }

    if (targetBranch === currentBranch) {
      message.warning("Target branch cannot be the same as current branch");
      return;
    }

    setLoading(true);
    try {
      const plan = await window.electronAPI.getRebasePlan(
        repoPath,
        currentBranch,
        targetBranch,
      );

      if (plan.commits.length === 0) {
        message.info("No commits to rebase. Branch is up to date.");
        setRebasePlan(null);
        setCommits([]);
        return;
      }

      setRebasePlan(plan);
      setCommits([...plan.commits]);
      message.success(`Found ${plan.commits.length} commits to rebase`);
    } catch (error: any) {
      message.error(`Failed to load rebase plan: ${error.message}`);
      setRebasePlan(null);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  };

  const startRebase = async () => {
    if (!repoPath || !rebasePlan || commits.length === 0) return;

    // Validate that we don't have only 'drop' actions
    const hasNonDropCommits = commits.some((c) => c.action !== "drop");
    if (!hasNonDropCommits) {
      message.warning("Cannot rebase: all commits are marked as 'drop'");
      return;
    }

    Modal.confirm({
      title: "Start Interactive Rebase",
      content: (
        <div>
          <p>
            This will rebase <strong>{commits.length} commits</strong> from{" "}
            <strong>{currentBranch}</strong> onto{" "}
            <strong>{targetBranch}</strong>.
          </p>
          <p>Actions to be performed:</p>
          <ul>
            {commits.map((commit, idx) => (
              <li key={idx}>
                <Tag color={getActionColor(commit.action)}>{commit.action}</Tag>{" "}
                {commit.shortHash} - {commit.message}
              </li>
            ))}
          </ul>
        </div>
      ),
      onOk: async () => {
        setLoading(true);
        try {
          const status = await window.electronAPI.startInteractiveRebase(
            repoPath,
            rebasePlan.targetBranch,
            commits,
          );

          setRebaseStatus(status);

          if (status.inProgress) {
            if (status.hasConflicts) {
              message.warning(
                "Rebase started but encountered conflicts. Please resolve them.",
              );
              setShowConflictResolution(true);
            } else {
              message.info("Rebase in progress...");
            }
          } else {
            message.success("Rebase completed successfully!");
            setRebasePlan(null);
            setCommits([]);
            onRefresh?.();
          }
        } catch (error: any) {
          message.error(`Failed to start rebase: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const continueRebase = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const status = await window.electronAPI.continueRebase(repoPath);
      setRebaseStatus(status);

      if (status.inProgress) {
        if (status.hasConflicts) {
          message.warning("More conflicts detected. Please resolve them.");
          setShowConflictResolution(true);
        } else {
          message.info("Rebase continuing...");
        }
      } else {
        message.success("Rebase completed successfully!");
        setRebasePlan(null);
        setCommits([]);
        setShowConflictResolution(false);
        onRefresh?.();
      }
    } catch (error: any) {
      message.error(`Failed to continue rebase: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const abortRebase = async () => {
    if (!repoPath) return;

    Modal.confirm({
      title: "Abort Rebase",
      content:
        "Are you sure you want to abort the rebase? All changes will be discarded.",
      okText: "Abort",
      okType: "danger",
      onOk: async () => {
        setLoading(true);
        try {
          await window.electronAPI.abortRebase(repoPath);
          message.success("Rebase aborted successfully");
          setRebaseStatus(null);
          setRebasePlan(null);
          setCommits([]);
          setShowConflictResolution(false);
          onRefresh?.();
        } catch (error: any) {
          message.error(`Failed to abort rebase: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const skipCommit = async () => {
    if (!repoPath) return;

    setLoading(true);
    try {
      const status = await window.electronAPI.skipRebaseCommit(repoPath);
      setRebaseStatus(status);

      if (status.inProgress) {
        message.info("Commit skipped. Rebase continuing...");
      } else {
        message.success("Rebase completed successfully!");
        setRebasePlan(null);
        setCommits([]);
        setShowConflictResolution(false);
        onRefresh?.();
      }
    } catch (error: any) {
      message.error(`Failed to skip commit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleActionChange = (
    index: number,
    action: RebaseCommit["action"],
  ) => {
    const newCommits = [...commits];
    newCommits[index].action = action;
    setCommits(newCommits);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newCommits = [...commits];
    const [draggedCommit] = newCommits.splice(draggedIndex, 1);
    newCommits.splice(dropIndex, 0, draggedCommit);

    setCommits(newCommits);
    setDraggedIndex(null);
    message.success("Commit reordered");
  };

  const handleEditMessage = (commit: RebaseCommit) => {
    setEditingCommit(commit);
    setNewCommitMessage(commit.message);
    setShowEditMessageModal(true);
  };

  const saveCommitMessage = () => {
    if (!editingCommit) return;

    const newCommits = commits.map((c) =>
      c.hash === editingCommit.hash ? { ...c, message: newCommitMessage } : c,
    );

    setCommits(newCommits);
    setShowEditMessageModal(false);
    setEditingCommit(null);
    setNewCommitMessage("");
    message.success("Commit message updated");
  };

  const handleSquashWith = (index: number) => {
    if (index === 0) {
      message.warning("Cannot squash the first commit");
      return;
    }

    const newCommits = [...commits];
    newCommits[index].action = "squash";
    setCommits(newCommits);
    message.success("Commit marked for squashing");
  };

  const getActionColor = (action: RebaseCommit["action"]) => {
    const colors: Record<RebaseCommit["action"], string> = {
      pick: "blue",
      reword: "orange",
      edit: "purple",
      squash: "cyan",
      fixup: "green",
      drop: "red",
    };
    return colors[action] || "default";
  };

  const getActionDescription = (action: RebaseCommit["action"]) => {
    const descriptions: Record<RebaseCommit["action"], string> = {
      pick: "Use commit as-is",
      reword: "Use commit, but edit the commit message",
      edit: "Use commit, but stop for amending",
      squash: "Meld into previous commit (keep messages)",
      fixup: "Like squash, but discard this commit message",
      drop: "Remove commit from history",
    };
    return descriptions[action] || "";
  };

  // If rebase is in progress, show rebase controls
  if (rebaseStatus?.inProgress) {
    return (
      <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
        <Card>
          <Alert
            message="Rebase In Progress"
            description={
              <Space direction="vertical" style={{ width: "100%" }}>
                <Text>
                  A rebase operation is currently in progress on this
                  repository.
                </Text>
                {rebaseStatus.hasConflicts && (
                  <Text type="danger">
                    <WarningOutlined />{" "}
                    {rebaseStatus.conflictedFiles?.length || 0} conflicted files
                    detected
                  </Text>
                )}
                {rebaseStatus.remainingCommits !== undefined && (
                  <Text>
                    Remaining commits: {rebaseStatus.remainingCommits}
                  </Text>
                )}
              </Space>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {rebaseStatus.hasConflicts && showConflictResolution && repoPath && (
            <div style={{ marginBottom: 16 }}>
              <ConflictResolutionPanel
                repoPath={repoPath}
                onRefresh={() => {
                  setShowConflictResolution(false);
                  checkRebaseStatus();
                }}
              />
            </div>
          )}

          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={continueRebase}
              loading={loading}
              disabled={rebaseStatus.hasConflicts}
            >
              Continue Rebase
            </Button>
            <Button
              icon={<FastForwardOutlined />}
              onClick={skipCommit}
              loading={loading}
            >
              Skip Commit
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={abortRebase}
              loading={loading}
            >
              Abort Rebase
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={checkRebaseStatus}
              loading={loading}
            >
              Refresh Status
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  // Normal rebase planner UI
  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
      <Card>
        <Title level={4}>
          <BranchesOutlined /> Interactive Rebase
        </Title>

        <Alert
          message="Interactive Rebase"
          description="Rebase allows you to rewrite commit history by reordering, squashing, editing, or dropping commits. Choose a target branch to rebase onto."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <div>
            <Text strong>Current Branch: </Text>
            <Tag color="blue">{currentBranch}</Tag>
          </div>

          <div>
            <Text strong>Target Branch: </Text>
            <Select
              style={{ width: 300 }}
              placeholder="Select target branch to rebase onto"
              value={targetBranch}
              onChange={setTargetBranch}
              showSearch
              filterOption={(input, option) =>
                String(option?.children || "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {branches
                .filter((b) => b.name !== currentBranch)
                .map((branch) => (
                  <Option key={branch.name} value={branch.name}>
                    {branch.name}
                  </Option>
                ))}
            </Select>
            <Button
              type="primary"
              onClick={loadRebasePlan}
              loading={loading}
              disabled={!targetBranch}
              style={{ marginLeft: 8 }}
            >
              Load Commits
            </Button>
          </div>
        </Space>

        {rebasePlan && commits.length > 0 && (
          <>
            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Alert
                message={`${commits.length} commits will be rebased`}
                description="Drag and drop to reorder. Change actions to modify how commits are applied."
                type="success"
                showIcon
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Text strong>Actions:</Text>
                {(
                  ["pick", "reword", "edit", "squash", "fixup", "drop"] as const
                ).map((action) => (
                  <Tooltip key={action} title={getActionDescription(action)}>
                    <Tag color={getActionColor(action)}>{action}</Tag>
                  </Tooltip>
                ))}
              </Space>
            </div>

            <div style={{ marginBottom: 16 }}>
              {commits.map((commit, index) => (
                <Card
                  key={commit.hash}
                  size="small"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{
                    marginBottom: 8,
                    cursor: "move",
                    opacity: draggedIndex === index ? 0.5 : 1,
                    borderLeft: `4px solid ${
                      commit.action === "drop"
                        ? "#ff4d4f"
                        : commit.action === "squash"
                          ? "#13c2c2"
                          : commit.action === "fixup"
                            ? "#52c41a"
                            : "#1890ff"
                    }`,
                  }}
                >
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Space
                      style={{ width: "100%", justifyContent: "space-between" }}
                    >
                      <Space>
                        <DragOutlined style={{ cursor: "move" }} />
                        <Select
                          value={commit.action}
                          onChange={(value) => handleActionChange(index, value)}
                          style={{ width: 100 }}
                        >
                          <Option value="pick">pick</Option>
                          <Option value="reword">reword</Option>
                          <Option value="edit">edit</Option>
                          <Option value="squash" disabled={index === 0}>
                            squash
                          </Option>
                          <Option value="fixup" disabled={index === 0}>
                            fixup
                          </Option>
                          <Option value="drop">drop</Option>
                        </Select>
                        <Tag>{commit.shortHash}</Tag>
                      </Space>

                      <Space>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEditMessage(commit)}
                        >
                          Edit Message
                        </Button>
                        {index > 0 && (
                          <Button
                            size="small"
                            icon={<MergeCellsOutlined />}
                            onClick={() => handleSquashWith(index)}
                          >
                            Squash
                          </Button>
                        )}
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleActionChange(index, "drop")}
                        >
                          Drop
                        </Button>
                      </Space>
                    </Space>

                    <div>
                      <Text strong>{commit.message}</Text>
                    </div>

                    <Space size="small">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {commit.author}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(commit.date).toLocaleString()}
                      </Text>
                    </Space>
                  </Space>
                </Card>
              ))}
            </div>

            <Space>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={startRebase}
                loading={loading}
              >
                Start Rebase
              </Button>
              <Button
                size="large"
                onClick={() => {
                  setRebasePlan(null);
                  setCommits([]);
                  setTargetBranch("");
                }}
              >
                Cancel
              </Button>
            </Space>
          </>
        )}

        {rebasePlan && commits.length === 0 && (
          <Empty
            description="No commits to rebase. The branch is up to date with the target."
            style={{ marginTop: 32 }}
          />
        )}
      </Card>

      <Modal
        title="Edit Commit Message"
        open={showEditMessageModal}
        onOk={saveCommitMessage}
        onCancel={() => {
          setShowEditMessageModal(false);
          setEditingCommit(null);
          setNewCommitMessage("");
        }}
        okText="Save"
        width={600}
      >
        {editingCommit && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Text type="secondary">Commit: {editingCommit.shortHash}</Text>
            </div>
            <TextArea
              rows={4}
              value={newCommitMessage}
              onChange={(e) => setNewCommitMessage(e.target.value)}
              placeholder="Enter new commit message"
            />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default InteractiveRebasePanel;
