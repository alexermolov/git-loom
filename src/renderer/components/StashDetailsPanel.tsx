import React, { useState, useEffect } from "react";
import { message } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useTheme } from "../ThemeContext";
import { StashEntry, CommitFile } from "../types";

interface StashDetailsPanelProps {
  repoPath: string | null;
  selectedStash: StashEntry | null;
}

const StashDetailsPanel: React.FC<StashDetailsPanelProps> = ({
  repoPath,
  selectedStash,
}) => {
  const { isDarkMode } = useTheme();
  const [stashDiff, setStashDiff] = useState<string>("");
  const [stashFiles, setStashFiles] = useState<CommitFile[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  useEffect(() => {
    if (repoPath && selectedStash) {
      loadStashDetails();
    } else {
      setStashDiff("");
      setStashFiles([]);
    }
  }, [repoPath, selectedStash]);

  const loadStashDetails = async () => {
    if (!repoPath || !selectedStash) return;

    setLoadingDiff(true);
    try {
      const [diff, files] = await Promise.all([
        window.electronAPI.getStashDiff(repoPath, selectedStash.index),
        window.electronAPI.getStashFiles(repoPath, selectedStash.index),
      ]);
      setStashDiff(diff);
      setStashFiles(files);
    } catch (error: any) {
      message.error(`Failed to load stash details: ${error.message}`);
    } finally {
      setLoadingDiff(false);
    }
  };

  if (!selectedStash) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <FileTextOutlined
            style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}
          />
          <div>Select a stash to view details</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
          Stash Details: {selectedStash.message}
        </h3>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginTop: "4px",
          }}
        >
          {stashFiles.length} file{stashFiles.length !== 1 ? "s" : ""} changed
        </div>
      </div>

      {/* Files Changed */}
      {stashFiles.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            maxHeight: "200px",
            overflow: "auto",
          }}
        >
          <h4
            style={{
              margin: "0 0 8px 0",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Changed Files:
          </h4>
          {stashFiles.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 8px",
                fontSize: "12px",
                backgroundColor:
                  idx % 2 === 0 ? "var(--bg-secondary)" : "transparent",
              }}
            >
              <span style={{ fontFamily: "monospace" }}>{file.path}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "green" }}>+{file.additions}</span>{" "}
                <span style={{ color: "red" }}>-{file.deletions}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Diff Viewer */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {loadingDiff ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            Loading diff...
          </div>
        ) : (
          <pre
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {stashDiff || "No diff available"}
          </pre>
        )}
      </div>
    </div>
  );
};

export default StashDetailsPanel;
