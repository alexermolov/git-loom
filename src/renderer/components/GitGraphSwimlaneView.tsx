import { Empty } from "antd";
import React, { useMemo } from "react";
import { CommitDetail } from "../types";

// ===== Git Graph (Swimlanes) =====
// This implementation mirrors the standalone HTML demo logic:
// - commits come from parsing `git log --format=...` (see src/main/gitWorker.ts)
// - lanes are calculated in JS and rendered as SVG

// Row/SVG height must match the rendered commit text height so
// the vertical lanes stay visually connected between rows.
const TEXT_LINE_HEIGHT = 18;
const ROW_PADDING_Y = 4;
const SWIMLANE_HEIGHT = TEXT_LINE_HEIGHT * 3 + ROW_PADDING_Y * 2;
const SWIMLANE_WIDTH = 11;
const SWIMLANE_CURVE_RADIUS = 5;
const CIRCLE_RADIUS = 4;
const CIRCLE_STROKE_WIDTH = 2;
const CIRCLE_STROKE_COLOR = "#fff";

const COLOR_PALETTE = ["#FFB000", "#DC267F", "#994F00", "#40B0A6", "#B66DFF"];

type RefCategory = "branch" | "remote" | "tag" | "head" | "other";

interface CommitRef {
  id: string;
  name: string;
  category: RefCategory;
  color?: string;
}

interface SwimlaneCommit {
  id: string;
  parentIds: string[];
  subject: string;
  displayId?: string;
  author?: string;
  timestamp?: number;
  references?: CommitRef[];
}

interface SwimlaneNode {
  id: string;
  color: string;
}

interface ViewModel {
  commit: SwimlaneCommit;
  kind: "HEAD" | "node";
  inputSwimlanes: SwimlaneNode[];
  outputSwimlanes: SwimlaneNode[];
}

function getNextColor(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function getLabelColor(commit: SwimlaneCommit, colorMap: Map<string, string>) {
  for (const ref of commit.references ?? []) {
    const color = colorMap.get(ref.id);
    if (color) return color;
  }
  return undefined;
}

function findLastIndex(nodes: SwimlaneNode[], id: string) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].id === id) return i;
  }
  return -1;
}

function buildGraphModel(commits: SwimlaneCommit[], headCommitId?: string) {
  const viewModels: ViewModel[] = [];
  let colorIndex = -1;
  const colorMap = new Map<string, string>();
  const commitMap = new Map(commits.map((c) => [c.id, c] as const));

  for (let index = 0; index < commits.length; index++) {
    const commit = commits[index];
    const kind: ViewModel["kind"] =
      commit.id === headCommitId ? "HEAD" : "node";

    const outputSwimlanesFromPreviousItem =
      viewModels.at(-1)?.outputSwimlanes ?? [];
    const inputSwimlanes = outputSwimlanesFromPreviousItem.map((node) => ({
      ...node,
    }));
    const outputSwimlanes: SwimlaneNode[] = [];

    let firstParentAdded = false;

    // Add first parent to the output, while preserving existing swimlanes.
    if (commit.parentIds.length > 0) {
      for (const node of inputSwimlanes) {
        if (node.id === commit.id) {
          if (!firstParentAdded) {
            outputSwimlanes.push({
              id: commit.parentIds[0],
              color: getLabelColor(commit, colorMap) || node.color,
            });
            firstParentAdded = true;
          }
          continue;
        }

        outputSwimlanes.push({ ...node });
      }
    }

    // Add unprocessed parent(s) to the output.
    for (let i = firstParentAdded ? 1 : 0; i < commit.parentIds.length; i++) {
      let color: string | undefined = undefined;

      if (i === 0) {
        color = getLabelColor(commit, colorMap);
      } else {
        const parentCommit = commitMap.get(commit.parentIds[i]);
        color = parentCommit
          ? getLabelColor(parentCommit, colorMap)
          : undefined;
      }

      if (!color) {
        color = getNextColor(++colorIndex);
      }

      outputSwimlanes.push({ id: commit.parentIds[i], color });
    }

    const references = (commit.references ?? []).map((ref) => {
      let color = colorMap.get(ref.id);
      if (!color) {
        const inputIndex = inputSwimlanes.findIndex(
          (node) => node.id === commit.id,
        );
        const circleIndex =
          inputIndex !== -1 ? inputIndex : inputSwimlanes.length;
        color =
          circleIndex < outputSwimlanes.length
            ? outputSwimlanes[circleIndex].color
            : circleIndex < inputSwimlanes.length
              ? inputSwimlanes[circleIndex].color
              : COLOR_PALETTE[0];
        colorMap.set(ref.id, color);
      }
      return { ...ref, color };
    });

    viewModels.push({
      commit: { ...commit, references },
      kind,
      inputSwimlanes,
      outputSwimlanes,
    });
  }

  return viewModels;
}

function renderCommitGraph(viewModel: ViewModel) {
  const { commit, inputSwimlanes, outputSwimlanes, kind } = viewModel;
  const midY = SWIMLANE_HEIGHT / 2;
  const inputIndex = inputSwimlanes.findIndex((node) => node.id === commit.id);
  const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length;
  const circleColor =
    circleIndex < outputSwimlanes.length
      ? outputSwimlanes[circleIndex].color
      : circleIndex < inputSwimlanes.length
        ? inputSwimlanes[circleIndex].color
        : COLOR_PALETTE[0];

  const paths: React.ReactNode[] = [];
  const circles: React.ReactNode[] = [];
  let outputSwimlaneIndex = 0;

  for (let index = 0; index < inputSwimlanes.length; index++) {
    const color = inputSwimlanes[index].color;

    if (inputSwimlanes[index].id === commit.id) {
      if (index !== circleIndex) {
        const d = `M ${SWIMLANE_WIDTH * (index + 1)} 0 A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * index} ${SWIMLANE_WIDTH} H ${SWIMLANE_WIDTH * (circleIndex + 1)}`;
        paths.push(
          <path
            key={`base-${index}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1}
            strokeLinecap="round"
          />,
        );
      } else {
        outputSwimlaneIndex++;
      }
    } else {
      if (
        outputSwimlaneIndex < outputSwimlanes.length &&
        inputSwimlanes[index].id === outputSwimlanes[outputSwimlaneIndex].id
      ) {
        if (index === outputSwimlaneIndex) {
          paths.push(
            <path
              key={`straight-${index}`}
              d={`M ${SWIMLANE_WIDTH * (index + 1)} 0 V ${SWIMLANE_HEIGHT}`}
              fill="none"
              stroke={color}
              strokeWidth={1}
              strokeLinecap="round"
            />,
          );
        } else {
          const d = `M ${SWIMLANE_WIDTH * (index + 1)} 0 V 6 A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 1 ${SWIMLANE_WIDTH * (index + 1) - SWIMLANE_CURVE_RADIUS} ${midY} H ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1) + SWIMLANE_CURVE_RADIUS} A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 0 ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1)} ${midY + SWIMLANE_CURVE_RADIUS} V ${SWIMLANE_HEIGHT}`;
          paths.push(
            <path
              key={`curve-${index}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1}
              strokeLinecap="round"
            />,
          );
        }
        outputSwimlaneIndex++;
      }
    }
  }

  for (let i = 1; i < commit.parentIds.length; i++) {
    const parentOutputIndex = findLastIndex(
      outputSwimlanes,
      commit.parentIds[i],
    );
    if (parentOutputIndex !== -1) {
      const color = outputSwimlanes[parentOutputIndex].color;
      const d = `M ${SWIMLANE_WIDTH * parentOutputIndex} ${midY} A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * (parentOutputIndex + 1)} ${SWIMLANE_HEIGHT} M ${SWIMLANE_WIDTH * parentOutputIndex} ${midY} H ${SWIMLANE_WIDTH * (circleIndex + 1)}`;
      paths.push(
        <path
          key={`parent-${i}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeLinecap="round"
        />,
      );
    }
  }

  if (inputIndex !== -1) {
    paths.push(
      <path
        key="to-circle"
        d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} 0 V ${midY}`}
        fill="none"
        stroke={inputSwimlanes[inputIndex].color}
        strokeWidth={1}
        strokeLinecap="round"
      />,
    );
  }

  if (commit.parentIds.length > 0) {
    paths.push(
      <path
        key="from-circle"
        d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} ${midY} V ${SWIMLANE_HEIGHT}`}
        fill="none"
        stroke={circleColor}
        strokeWidth={1}
        strokeLinecap="round"
      />,
    );
  }

  if (kind === "HEAD") {
    circles.push(
      <circle
        key="outer-head"
        cx={SWIMLANE_WIDTH * (circleIndex + 1)}
        cy={midY}
        r={CIRCLE_RADIUS + 3}
        fill={circleColor}
        stroke={CIRCLE_STROKE_COLOR}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
    circles.push(
      <circle
        key="inner-head"
        cx={SWIMLANE_WIDTH * (circleIndex + 1)}
        cy={midY}
        r={CIRCLE_STROKE_WIDTH}
        fill="#fff"
        stroke={CIRCLE_STROKE_COLOR}
        strokeWidth={CIRCLE_RADIUS}
      />,
    );
  } else if (commit.parentIds.length > 1) {
    circles.push(
      <circle
        key="outer-multi"
        cx={SWIMLANE_WIDTH * (circleIndex + 1)}
        cy={midY}
        r={CIRCLE_RADIUS + 2}
        fill={circleColor}
        stroke={CIRCLE_STROKE_COLOR}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
    circles.push(
      <circle
        key="inner-multi"
        cx={SWIMLANE_WIDTH * (circleIndex + 1)}
        cy={midY}
        r={CIRCLE_RADIUS - 1}
        fill={circleColor}
        stroke={CIRCLE_STROKE_COLOR}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
  } else {
    circles.push(
      <circle
        key="normal"
        cx={SWIMLANE_WIDTH * (circleIndex + 1)}
        cy={midY}
        r={CIRCLE_RADIUS + 1}
        fill={circleColor}
        stroke={CIRCLE_STROKE_COLOR}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
  }

  const width =
    SWIMLANE_WIDTH *
    (Math.max(inputSwimlanes.length, outputSwimlanes.length, 1) + 1);

  return (
    <svg width={width} height={SWIMLANE_HEIGHT} style={{ display: "block" }}>
      {paths}
      {circles}
    </svg>
  );
}

function formatCommitDate(timestamp?: number) {
  if (!timestamp) return undefined;
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return undefined;
  }
}

function parseRefs(refs: string[]): CommitRef[] {
  const out: CommitRef[] = [];

  for (const rawToken of refs) {
    const token = (rawToken || "").trim();
    if (!token) continue;

    if (token.includes("HEAD ->")) {
      out.push({ id: "HEAD", name: "HEAD", category: "head" });
      const branch = token.split("HEAD ->")[1]?.trim();
      if (branch) {
        out.push({ id: `branch:${branch}`, name: branch, category: "branch" });
      }
      continue;
    }

    if (token === "HEAD") {
      out.push({ id: "HEAD", name: "HEAD", category: "head" });
      continue;
    }

    if (/^tag:\s*/i.test(token)) {
      const name = token.replace(/^tag:\s*/i, "").trim();
      out.push({
        id: `tag:${name || token}`,
        name: name || token,
        category: "tag",
      });
      continue;
    }

    if (token.includes("/")) {
      out.push({ id: `remote:${token}`, name: token, category: "remote" });
      continue;
    }

    out.push({ id: `branch:${token}`, name: token, category: "branch" });
  }

  // De-dup by id (can happen with weird decorations)
  const seen = new Set<string>();
  return out.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

function detailsToSwimlaneCommit(detail: CommitDetail): SwimlaneCommit {
  const timestamp = (() => {
    const t = Date.parse(detail.date);
    return Number.isFinite(t) ? t : undefined;
  })();

  return {
    id: detail.hash,
    parentIds: detail.parents ?? [],
    subject: (detail.message ?? "").replace(/\r?\n/g, " ").trim(),
    displayId: detail.hash?.slice(0, 7),
    author: detail.author,
    timestamp,
    references: parseRefs(detail.refs ?? []),
  };
}

function commitMatchesQuery(commit: SwimlaneCommit, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const refs = (commit.references ?? []).map((r) => r.name).join(" ");
  const hay =
    `${commit.id} ${commit.displayId ?? ""} ${commit.subject} ${commit.author ?? ""} ${refs}`.toLowerCase();
  return hay.includes(q);
}

export default function GitGraphSwimlaneView(props: {
  commitDetails: CommitDetail[];
  searchQuery: string;
  onCommitClick?: (commitHash: string, message?: string) => void;
}) {
  const { commitDetails, searchQuery, onCommitClick } = props;

  const commits = useMemo(
    () => commitDetails.map(detailsToSwimlaneCommit),
    [commitDetails],
  );

  const headCommitId = useMemo(() => {
    for (const c of commits) {
      if ((c.references ?? []).some((r) => r.category === "head")) return c.id;
    }
    return commits[0]?.id;
  }, [commits]);

  const filteredCommits = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return commits;
    return commits.filter((c) => commitMatchesQuery(c, q));
  }, [commits, searchQuery]);

  const viewModels = useMemo(
    () => buildGraphModel(filteredCommits, headCommitId),
    [filteredCommits, headCommitId],
  );

  if (commitDetails.length === 0) {
    return <Empty description="No commits" />;
  }

  return (
    <div
      style={{ fontFamily: "monospace", fontSize: 14 }}
    >
      {viewModels.map((viewModel) => (
        <div
          key={viewModel.commit.id}
          style={{
            display: "flex",
            alignItems: "center",
            height: `${SWIMLANE_HEIGHT}px`,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            paddingRight: 8,
          }}
        >
          <div style={{ flexShrink: 0 }}>{renderCommitGraph(viewModel)}</div>
          <div
            style={{
              marginLeft: 12,
              flexGrow: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 2,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontWeight: viewModel.kind === "HEAD" ? 700 : 400,
                lineHeight: `${TEXT_LINE_HEIGHT}px`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={viewModel.commit.subject}
            >
              {viewModel.commit.subject}
            </div>

            <div
              style={{
                lineHeight: `${TEXT_LINE_HEIGHT}px`,
                fontSize: 12,
                color: "#666",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={[
                viewModel.commit.author,
                formatCommitDate(viewModel.commit.timestamp),
              ]
                .filter(Boolean)
                .join(" • ")}
            >
              {(() => {
                const date = formatCommitDate(viewModel.commit.timestamp);
                const author = viewModel.commit.author;
                if (author && date) return `${author} • ${date}`;
                return author || date || "";
              })()}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                lineHeight: `${TEXT_LINE_HEIGHT}px`,
                fontSize: 12,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {viewModel.commit.displayId && (
                <span
                  role={onCommitClick ? "button" : undefined}
                  tabIndex={onCommitClick ? 0 : -1}
                  onClick={
                    onCommitClick
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onCommitClick(viewModel.commit.id, viewModel.commit.subject);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onCommitClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onCommitClick(viewModel.commit.id, viewModel.commit.subject);
                          }
                        }
                      : undefined
                  }
                  style={{
                    color: onCommitClick ? "var(--accent-color)" : "#666",
                    cursor: onCommitClick ? "pointer" : "default",
                    flexShrink: 0,
                    textDecoration: onCommitClick ? "underline" : "none",
                    textDecorationStyle: onCommitClick ? "dotted" : undefined,
                    outline: "none",
                  }}
                  title={viewModel.commit.id}
                >
                  {viewModel.commit.displayId}
                </span>
              )}

              {viewModel.commit.references &&
                viewModel.commit.references.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "nowrap",
                      gap: 4,
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                  >
                    {viewModel.commit.references.map((ref) => (
                      <span
                        key={ref.id}
                        style={{
                          display: "inline-block",
                          backgroundColor: ref.color || "#e0e0e0",
                          color: "#fff",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontSize: 11,
                          lineHeight: "16px",
                          flexShrink: 0,
                        }}
                        title={ref.name}
                      >
                        {ref.name}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
