import {
  ArrowLeftOutlined,
  ColumnWidthOutlined,
  MenuOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Empty,
  Modal,
  Segmented,
  Space,
  Tag,
  Tooltip,
  message,
} from "antd";
import "diff2html/bundles/css/diff2html.min.css";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";
import { ConflictFile, ConflictMarker, FileDiff } from "../types";

// Import diff2html with proper typing
const Diff2Html = require("diff2html") as {
  html: (diffInput: string, config?: any) => string;
  parse: (diffInput: string, config?: any) => any[];
};

interface FileDiffPanelProps {
  diff: FileDiff | null;
  onBack: () => void;
  repoPath?: string | null;
  filePath?: string;
  onRefresh?: () => void;
}

const FileDiffPanel: React.FC<FileDiffPanelProps> = ({
  diff,
  onBack,
  repoPath,
  filePath,
  onRefresh,
}) => {
  const { isDarkMode } = useTheme();
  const { modal } = App.useApp();
  const [conflictInfo, setConflictInfo] = useState<ConflictFile | null>(null);
  const [resolving, setResolving] = useState(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<
    "side-by-side" | "line-by-line"
  >("side-by-side");
  const diffContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear stale conflict state immediately when switching files
    setConflictInfo(null);
    setEditingContent(null);
    loadConflicts();
  }, [repoPath, filePath]);

  const loadConflicts = async () => {
    if (!repoPath || !filePath) return;

    try {
      const conflicts = await window.electronAPI.getFileConflicts(
        repoPath,
        filePath,
      );
      if (conflicts.conflicts.length > 0) {
        setConflictInfo(conflicts);
        setEditingContent(conflicts.content);
      } else {
        setConflictInfo(null);
      }
    } catch (error) {
      // File might not have conflicts, that's ok
      setConflictInfo(null);
    }
  };

  const handleResolveConflict = async (
    conflictIndex: number,
    resolution: "ours" | "theirs" | "both",
  ) => {
    if (!repoPath || !filePath) return;

    setResolving(true);
    try {
      await window.electronAPI.resolveConflict(
        repoPath,
        filePath,
        resolution,
        conflictIndex,
      );
      message.success(
        `Conflict ${conflictIndex + 1} resolved using "${resolution}"`,
      );
      await loadConflicts();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error resolving conflict:", error);
      message.error(`Failed to resolve conflict: ${error}`);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveAllConflicts = async (
    resolution: "ours" | "theirs" | "both",
  ) => {
    if (!repoPath || !filePath) return;

    modal.confirm({
      title: `Resolve All Conflicts`,
      content: `Are you sure you want to resolve all conflicts in this file using "${resolution}"?`,
      okText: "Resolve All",
      cancelText: "Cancel",
      onOk: async () => {
        setResolving(true);
        try {
          await window.electronAPI.resolveConflict(
            repoPath,
            filePath,
            resolution,
          );
          message.success(`All conflicts resolved using "${resolution}"`);
          await loadConflicts();
          if (onRefresh) onRefresh();
        } catch (error) {
          console.error("Error resolving all conflicts:", error);
          message.error(`Failed to resolve conflicts: ${error}`);
        } finally {
          setResolving(false);
        }
      },
    });
  };

  const handleManualResolve = () => {
    setShowEditModal(true);
  };

  const handleSaveManualResolve = async () => {
    if (!repoPath || !filePath || !editingContent) return;

    setResolving(true);
    try {
      await window.electronAPI.resolveConflictManual(
        repoPath,
        filePath,
        editingContent,
      );
      message.success("File resolved and staged successfully");
      setShowEditModal(false);
      await loadConflicts();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error saving manual resolution:", error);
      message.error(`Failed to save resolution: ${error}`);
    } finally {
      setResolving(false);
    }
  };

  const handleLaunchMergeTool = async () => {
    if (!repoPath || !filePath) return;

    try {
      await window.electronAPI.launchMergeTool(repoPath, filePath);
      message.success("Launched external merge tool");
      setTimeout(() => {
        loadConflicts();
        if (onRefresh) onRefresh();
      }, 2000);
    } catch (error) {
      console.error("Error launching merge tool:", error);
      message.error(`Failed to launch merge tool: ${error}`);
    }
  };

  const looksLikeUnifiedDiff = (text: string) => {
    if (!text) return false;
    // Prefer strong signals to avoid mis-detecting frontmatter like "---" in markdown.
    const hasDiffGitHeader = /^diff --git\s/m.test(text);
    const hasClassicHeaders = /^---\s+a\//m.test(text) && /^\+\+\+\s+b\//m.test(text);
    const hasHunks = /^@@\s/m.test(text);
    return hasDiffGitHeader || hasClassicHeaders || hasHunks;
  };

  const diffText = diff?.diff ?? "";
  const diffContent = diffText.trim();
  const isDiff = looksLikeUnifiedDiff(diffText);
  const isBinary = isDiff && diffContent.includes("Binary files");
  const isEmpty = diffContent === "";
  const hasConflicts =
    conflictInfo !== null && conflictInfo.conflicts.length > 0;
  const showBinaryMessage = isBinary && !hasConflicts;
  const showEmptyMessage = isEmpty && !hasConflicts;

  // Render diff using diff2html (layout effect prevents a flash of stale HTML)
  useLayoutEffect(() => {
    const container = diffContainerRef.current;
    if (!container) return;

    // Clear container first to prevent old diff from showing
    container.innerHTML = "";

    // Don't render diff for binary or empty files
    if (showBinaryMessage || showEmptyMessage) {
      return;
    }

    if (diffText) {
      // File Explorer uses raw file text (not a patch). Render it safely as plain text.
      if (!isDiff) {
        const pre = document.createElement("pre");
        pre.textContent = diffText;
        pre.style.margin = "0";
        pre.style.padding = "12px";
        pre.style.whiteSpace = "pre";
        pre.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
        pre.style.fontSize = "13px";
        pre.style.lineHeight = "1.45";
        pre.style.color = isDarkMode ? "#d4d4d4" : "#1f1f1f";
        container.appendChild(pre);
        return;
      }

      try {
        const diffHtml = Diff2Html.html(diffText, {
          drawFileList: false,
          matching: "lines",
          outputFormat: diffViewMode,
          renderNothingWhenEmpty: false,
          colorScheme: isDarkMode ? "dark" : "light",
        });
        container.innerHTML = diffHtml;

        // Add theme class to wrapper
        const wrapper = container.querySelector(".d2h-wrapper");
        if (wrapper) {
          wrapper.setAttribute("data-theme", isDarkMode ? "dark" : "light");
        }
      } catch (error) {
        console.error("Error rendering diff:", error);
        // Fallback to line-by-line view
        try {
          const diffHtml = Diff2Html.html(diffText, {
            drawFileList: false,
            matching: "lines",
            outputFormat: "line-by-line",
            renderNothingWhenEmpty: false,
            colorScheme: isDarkMode ? "dark" : "light",
          });
          container.innerHTML = diffHtml;

          // Add theme class to wrapper
          const wrapper = container.querySelector(".d2h-wrapper");
          if (wrapper) {
            wrapper.setAttribute("data-theme", isDarkMode ? "dark" : "light");
          }
        } catch (fallbackError) {
          console.error("Error rendering diff with fallback:", fallbackError);
        }
      }
    }
  }, [
    diffText,
    diff?.path,
    isDarkMode,
    diffViewMode,
    isDiff,
    showBinaryMessage,
    showEmptyMessage,
  ]);

  const renderConflictBlock = (
    conflict: ConflictMarker,
    conflictIndex: number,
  ) => {
    return (
      <div
        key={`conflict-${conflictIndex}`}
        style={{
          margin: "16px 0",
          border: "2px solid #ff4d4f",
          borderRadius: 8,
          backgroundColor: isDarkMode ? "#2a1a1a" : "#fff7f7",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#ff4d4f",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <WarningOutlined />
            <span style={{ fontWeight: 600 }}>
              Conflict {conflictIndex + 1}
            </span>
          </div>
          <Space size="small">
            <Tooltip title="Accept your changes (HEAD)">
              <Button
                size="small"
                type="primary"
                ghost
                loading={resolving}
                onClick={() => handleResolveConflict(conflictIndex, "ours")}
                style={{ borderColor: "white", color: "white" }}
              >
                Ours
              </Button>
            </Tooltip>
            <Tooltip title="Accept their changes (incoming)">
              <Button
                size="small"
                type="primary"
                ghost
                loading={resolving}
                onClick={() => handleResolveConflict(conflictIndex, "theirs")}
                style={{ borderColor: "white", color: "white" }}
              >
                Theirs
              </Button>
            </Tooltip>
            <Tooltip title="Accept both changes">
              <Button
                size="small"
                type="primary"
                ghost
                loading={resolving}
                onClick={() => handleResolveConflict(conflictIndex, "both")}
                style={{ borderColor: "white", color: "white" }}
              >
                Both
              </Button>
            </Tooltip>
          </Space>
        </div>

        <div style={{ padding: 12 }}>
          {/* Current (HEAD) section */}
          <div style={{ marginBottom: 12 }}>
            <Tag color="blue" style={{ marginBottom: 8 }}>
              Current Changes (HEAD)
            </Tag>
            <div
              style={{
                backgroundColor: isDarkMode ? "#1a3a1a" : "#f6ffed",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #52c41a",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 13,
                  color: "#52c41a",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {conflict.currentContent || "(empty)"}
              </pre>
            </div>
          </div>

          {/* Base section (if available) */}
          {conflict.baseContent && (
            <div style={{ marginBottom: 12 }}>
              <Tag color="default" style={{ marginBottom: 8 }}>
                Base (Common Ancestor)
              </Tag>
              <div
                style={{
                  backgroundColor: isDarkMode ? "#2a2a2a" : "#f5f5f5",
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #d9d9d9",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {conflict.baseContent}
                </pre>
              </div>
            </div>
          )}

          {/* Incoming section */}
          <div>
            <Tag color="orange" style={{ marginBottom: 8 }}>
              Incoming Changes
            </Tag>
            <div
              style={{
                backgroundColor: isDarkMode ? "#3a2a1a" : "#fffbe6",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #faad14",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 13,
                  color: "#faad14",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {conflict.incomingContent || "(empty)"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!diff) {
    return (
      <div className="file-diff-panel">
        <div style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            Back to Files
          </Button>
        </div>
        <Empty
          description="Select a file to view its changes"
          style={{ marginTop: 60 }}
        />
      </div>
    );
  }

  return (
    <div className="file-diff-panel">
      <div
        style={{
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ marginBottom: 12 }}
        >
          Back to Files
        </Button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 16,
                color: "var(--text-primary)",
              }}
            >
              {diff.path}
            </div>
            {showBinaryMessage && <Tag color="orange">Binary File</Tag>}
            {showEmptyMessage && <Tag color="default">Empty/No Changes</Tag>}
            {hasConflicts && (
              <Tag icon={<WarningOutlined />} color="error">
                {conflictInfo.conflicts.length} Conflict
                {conflictInfo.conflicts.length > 1 ? "s" : ""}
              </Tag>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isDiff && !showBinaryMessage && !showEmptyMessage && (
              <Segmented
                size="small"
                value={diffViewMode}
                onChange={(value) =>
                  setDiffViewMode(value as "side-by-side" | "line-by-line")
                }
                options={[
                  {
                    label: (
                      <Tooltip title="Side by side view">
                        <ColumnWidthOutlined />
                      </Tooltip>
                    ),
                    value: "side-by-side",
                  },
                  {
                    label: (
                      <Tooltip title="Line by line view">
                        <MenuOutlined />
                      </Tooltip>
                    ),
                    value: "line-by-line",
                  },
                ]}
              />
            )}
            {isDiff && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                <span style={{ color: "#52c41a", marginRight: 8 }}>
                  +{diff.additions}
                </span>
                <span style={{ color: "#ff4d4f" }}>-{diff.deletions}</span>
              </div>
            )}
          </div>
        </div>

        {/* Conflict resolution toolbar */}
        {hasConflicts && (
          <Space wrap style={{ marginTop: 12 }}>
            <Tooltip title="Resolve all conflicts by accepting your changes">
              <Button
                size="small"
                type="primary"
                loading={resolving}
                onClick={() => handleResolveAllConflicts("ours")}
              >
                Accept All Ours
              </Button>
            </Tooltip>
            <Tooltip title="Resolve all conflicts by accepting their changes">
              <Button
                size="small"
                type="primary"
                loading={resolving}
                onClick={() => handleResolveAllConflicts("theirs")}
              >
                Accept All Theirs
              </Button>
            </Tooltip>
            <Tooltip title="Resolve all conflicts by keeping both changes">
              <Button
                size="small"
                type="primary"
                loading={resolving}
                onClick={() => handleResolveAllConflicts("both")}
              >
                Accept All Both
              </Button>
            </Tooltip>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={handleManualResolve}
            >
              Edit Manually
            </Button>
            <Button size="small" onClick={handleLaunchMergeTool}>
              Launch Merge Tool
            </Button>
          </Space>
        )}
      </div>

      {/* Show conflict blocks if available */}
      {hasConflicts && (
        <div style={{ marginBottom: 16 }}>
          {conflictInfo.conflicts.map((conflict, index) =>
            renderConflictBlock(conflict, index),
          )}
        </div>
      )}

      {/* Show binary file message */}
      {showBinaryMessage ? (
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 4,
            padding: 40,
            textAlign: "center",
          }}
        >
          <Empty
            description={
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Binary File
                </div>
                <div style={{ color: "var(--text-secondary)" }}>
                  This file appears to be a binary file. Text diff is not
                  available.
                </div>
              </div>
            }
          />
        </div>
      ) : showEmptyMessage ? (
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 4,
            padding: 40,
            textAlign: "center",
          }}
        >
          <Empty
            description={
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {isDiff ? "No Changes" : "Empty File"}
                </div>
                <div style={{ color: "var(--text-secondary)" }}>
                  {isDiff
                    ? "This file has no visible changes."
                    : "This file is empty."}
                </div>
              </div>
            }
          />
        </div>
      ) : null}

      {/* Always mount the diff container so we can reliably clear stale HTML */}
      <div
        key={`${diff.path}:${diffViewMode}:${isDarkMode ? "dark" : "light"}`}
        ref={diffContainerRef}
        style={{
          display: showBinaryMessage || showEmptyMessage ? "none" : "block",
          backgroundColor: isDarkMode ? "#1e1e1e" : "#ffffff",
          border: "1px solid var(--border-color)",
          borderRadius: 4,
          overflow: "auto",
          maxHeight: "calc(100vh - 300px)",
        }}
      />

      {/* Manual edit modal */}
      <Modal
        title="Manually Resolve Conflicts"
        open={showEditModal}
        onCancel={() => setShowEditModal(false)}
        onOk={handleSaveManualResolve}
        width={800}
        confirmLoading={resolving}
        okText="Save & Stage"
        cancelText="Cancel"
      >
        <div
          style={{
            marginBottom: 12,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          Edit the file content below to resolve conflicts manually. When saved,
          the file will be staged automatically.
        </div>
        <textarea
          value={editingContent || ""}
          onChange={(e) => setEditingContent(e.target.value)}
          style={{
            width: "100%",
            height: 400,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: 13,
            padding: 8,
            border: "1px solid var(--border-color)",
            borderRadius: 4,
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
          }}
        />
      </Modal>
    </div>
  );
};

export default FileDiffPanel;
