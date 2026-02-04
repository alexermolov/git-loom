import { Empty } from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import { CommitDetail } from '../types';

// ===== Git Graph (Swimlanes) =====
// This implementation mirrors the standalone HTML demo logic:
// - commits come from parsing `git log --format=...` (see src/main/gitWorker.ts)
// - lanes are calculated in JS and rendered as SVG

const SWIMLANE_HEIGHT = 22;
const SWIMLANE_WIDTH = 11;
const SWIMLANE_CURVE_RADIUS = 5;
const CIRCLE_RADIUS = 4;
const CIRCLE_STROKE_WIDTH = 2;
const CIRCLE_STROKE_COLOR = '#fff';

const COLOR_PALETTE = ['#FFB000', '#DC267F', '#994F00', '#40B0A6', '#B66DFF'];

type RefCategory = 'branch' | 'remote' | 'tag' | 'head' | 'other';

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
  kind: 'HEAD' | 'node';
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
    const kind: ViewModel['kind'] = commit.id === headCommitId ? 'HEAD' : 'node';

    const outputSwimlanesFromPreviousItem = viewModels.at(-1)?.outputSwimlanes ?? [];
    const inputSwimlanes = outputSwimlanesFromPreviousItem.map((node) => ({ ...node }));
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
        color = parentCommit ? getLabelColor(parentCommit, colorMap) : undefined;
      }

      if (!color) {
        color = getNextColor(++colorIndex);
      }

      outputSwimlanes.push({ id: commit.parentIds[i], color });
    }

    const references = (commit.references ?? []).map((ref) => {
      let color = colorMap.get(ref.id);
      if (!color) {
        const inputIndex = inputSwimlanes.findIndex((node) => node.id === commit.id);
        const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length;
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
          const d = `M ${SWIMLANE_WIDTH * (index + 1)} 0 V 6 A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 1 ${(SWIMLANE_WIDTH * (index + 1)) - SWIMLANE_CURVE_RADIUS} ${SWIMLANE_HEIGHT / 2} H ${(SWIMLANE_WIDTH * (outputSwimlaneIndex + 1)) + SWIMLANE_CURVE_RADIUS} A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 0 ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1)} ${(SWIMLANE_HEIGHT / 2) + SWIMLANE_CURVE_RADIUS} V ${SWIMLANE_HEIGHT}`;
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
    const parentOutputIndex = findLastIndex(outputSwimlanes, commit.parentIds[i]);
    if (parentOutputIndex !== -1) {
      const color = outputSwimlanes[parentOutputIndex].color;
      const d = `M ${SWIMLANE_WIDTH * parentOutputIndex} ${SWIMLANE_HEIGHT / 2} A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * (parentOutputIndex + 1)} ${SWIMLANE_HEIGHT} M ${SWIMLANE_WIDTH * parentOutputIndex} ${SWIMLANE_HEIGHT / 2} H ${SWIMLANE_WIDTH * (circleIndex + 1)}`;
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
        d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} 0 V ${SWIMLANE_HEIGHT / 2}`}
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
        d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} ${SWIMLANE_HEIGHT / 2} V ${SWIMLANE_HEIGHT}`}
        fill="none"
        stroke={circleColor}
        strokeWidth={1}
        strokeLinecap="round"
      />,
    );
  }

  if (kind === 'HEAD') {
    circles.push(
      <circle
        key="outer-head"
        cx={SWIMLANE_WIDTH * (circleIndex + 1)}
        cy={SWIMLANE_WIDTH}
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
        cy={SWIMLANE_WIDTH}
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
        cy={SWIMLANE_WIDTH}
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
        cy={SWIMLANE_WIDTH}
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
        cy={SWIMLANE_WIDTH}
        r={CIRCLE_RADIUS + 1}
        fill={circleColor}
        stroke={CIRCLE_STROKE_COLOR}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
  }

  const width = SWIMLANE_WIDTH * (Math.max(inputSwimlanes.length, outputSwimlanes.length, 1) + 1);

  return (
    <svg width={width} height={SWIMLANE_HEIGHT} style={{ display: 'block' }}>
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

function CommitHoverCard({ commit }: { commit: SwimlaneCommit }) {
  const date = formatCommitDate(commit.timestamp);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 520 }}>
      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {commit.subject}
      </div>
      {commit.displayId && <div style={{ fontSize: 12, color: '#666' }}>{commit.displayId}</div>}
      {(commit.author || date) && (
        <div style={{ fontSize: 12, color: '#666' }}>
          {commit.author ? commit.author : ''}
          {commit.author && date ? ' • ' : ''}
          {date ? date : ''}
        </div>
      )}
      {commit.references && commit.references.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {commit.references.map((ref) => (
            <span
              key={ref.id}
              style={{
                display: 'inline-block',
                backgroundColor: ref.color || '#e0e0e0',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 11,
              }}
            >
              {ref.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function parseRefs(refs: string[]): CommitRef[] {
  const out: CommitRef[] = [];

  for (const rawToken of refs) {
    const token = (rawToken || '').trim();
    if (!token) continue;

    if (token.includes('HEAD ->')) {
      out.push({ id: 'HEAD', name: 'HEAD', category: 'head' });
      const branch = token.split('HEAD ->')[1]?.trim();
      if (branch) {
        out.push({ id: `branch:${branch}`, name: branch, category: 'branch' });
      }
      continue;
    }

    if (token === 'HEAD') {
      out.push({ id: 'HEAD', name: 'HEAD', category: 'head' });
      continue;
    }

    if (/^tag:\s*/i.test(token)) {
      const name = token.replace(/^tag:\s*/i, '').trim();
      out.push({ id: `tag:${name || token}`, name: name || token, category: 'tag' });
      continue;
    }

    if (token.includes('/')) {
      out.push({ id: `remote:${token}`, name: token, category: 'remote' });
      continue;
    }

    out.push({ id: `branch:${token}`, name: token, category: 'branch' });
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
    subject: detail.message,
    displayId: detail.hash?.slice(0, 7),
    author: detail.author,
    timestamp,
    references: parseRefs(detail.refs ?? []),
  };
}

function commitMatchesQuery(commit: SwimlaneCommit, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const refs = (commit.references ?? []).map((r) => r.name).join(' ');
  const hay = `${commit.id} ${commit.displayId ?? ''} ${commit.subject} ${commit.author ?? ''} ${refs}`.toLowerCase();
  return hay.includes(q);
}

export default function GitGraphSwimlaneView(props: {
  commitDetails: CommitDetail[];
  searchQuery: string;
  onCommitClick?: (commitHash: string, message?: string) => void;
}) {
  const { commitDetails, searchQuery, onCommitClick } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ commit: SwimlaneCommit; left: number; top: number } | undefined>(undefined);

  const commits = useMemo(() => commitDetails.map(detailsToSwimlaneCommit), [commitDetails]);

  const headCommitId = useMemo(() => {
    for (const c of commits) {
      if ((c.references ?? []).some((r) => r.category === 'head')) return c.id;
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

  const hideHover = () => setHover(undefined);

  if (commitDetails.length === 0) {
    return <Empty description="No commits" />;
  }

  return (
    <div
      ref={containerRef}
      style={{ fontFamily: 'monospace', fontSize: 14, position: 'relative' }}
      onMouseLeave={hideHover}
    >
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: hover.left,
            top: hover.top,
            zIndex: 10,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            padding: 10,
            pointerEvents: 'none',
          }}
        >
          <CommitHoverCard commit={hover.commit} />
        </div>
      )}

      {viewModels.map((viewModel) => (
        <div
          key={viewModel.commit.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: `${SWIMLANE_HEIGHT}px`,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            cursor: onCommitClick ? 'pointer' : 'default',
            paddingRight: 8,
          }}
          onMouseEnter={(e) => {
            const container = containerRef.current;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const rowRect = e.currentTarget.getBoundingClientRect();
            const left = Math.min(containerRect.width - 20, Math.max(0, rowRect.right - containerRect.left + 12));
            const top = Math.min(containerRect.height - 20, Math.max(0, rowRect.top - containerRect.top));
            setHover({ commit: viewModel.commit, left, top });
          }}
          onFocus={(e) => {
            const container = containerRef.current;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const rowRect = e.currentTarget.getBoundingClientRect();
            const left = Math.min(containerRect.width - 20, Math.max(0, rowRect.right - containerRect.left + 12));
            const top = Math.min(containerRect.height - 20, Math.max(0, rowRect.top - containerRect.top));
            setHover({ commit: viewModel.commit, left, top });
          }}
          onBlur={hideHover}
          onClick={() => onCommitClick?.(viewModel.commit.id, viewModel.commit.subject)}
          tabIndex={0}
        >
          <div style={{ flexShrink: 0 }}>{renderCommitGraph(viewModel)}</div>
          <div style={{ marginLeft: 12, flexGrow: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontWeight: viewModel.kind === 'HEAD' ? 700 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={viewModel.commit.subject}
            >
              {viewModel.commit.subject}
            </div>
            {viewModel.commit.references && viewModel.commit.references.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {viewModel.commit.references.map((ref) => (
                  <span
                    key={ref.id}
                    style={{
                      display: 'inline-block',
                      backgroundColor: ref.color || '#e0e0e0',
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 11,
                      lineHeight: '16px',
                    }}
                  >
                    {ref.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
