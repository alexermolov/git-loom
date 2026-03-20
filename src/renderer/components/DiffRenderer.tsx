/**
 * DiffRenderer – a pure-React unified diff renderer.
 *
 * Replaces diff2html. No innerHTML, no external CSS, no third-party library
 * beyond React itself. Parses unified-diff text and renders it as a table
 * with proper line numbers, dark/light theming, and both line-by-line and
 * side-by-side layouts.
 */
import React, { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LineType = "add" | "del" | "ctx" | "hunk";

interface DiffLine {
  type: LineType;
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

interface DiffFile {
  path: string;
  headers: string[];
  lines: DiffLine[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseDiff(text: string): DiffFile[] {
  if (!text) return [];

  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let oldN = 0;
  let newN = 0;

  for (const raw of text.split("\n")) {
    if (raw.startsWith("diff ")) {
      if (file) files.push(file);
      const m = raw.match(/diff --git a\/.+? b\/(.+)/);
      file = { path: m?.[1] ?? "", headers: [raw], lines: [] };
      oldN = 0;
      newN = 0;
    } else if (!file) {
      continue;
    } else if (raw.startsWith("+++ ")) {
      file.headers.push(raw);
      if (!file.path) {
        const p = raw.slice(4).replace(/^b\//, "");
        if (p !== "/dev/null") file.path = p;
      }
    } else if (
      /^(--- |index |new file|deleted file|old mode|new mode|rename |similarity |Binary )/.test(
        raw,
      )
    ) {
      file.headers.push(raw);
    } else if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldN = +m[1];
        newN = +m[2];
      }
      file.lines.push({ type: "hunk", content: raw, oldNum: null, newNum: null });
    } else if (raw.startsWith("+")) {
      file.lines.push({ type: "add", content: raw.slice(1), oldNum: null, newNum: newN++ });
    } else if (raw.startsWith("-")) {
      file.lines.push({ type: "del", content: raw.slice(1), oldNum: oldN++, newNum: null });
    } else if (raw.startsWith(" ")) {
      file.lines.push({ type: "ctx", content: raw.slice(1), oldNum: oldN++, newNum: newN++ });
    }
    // skip: \\ No newline, separator lines, etc.
  }

  if (file) files.push(file);
  return files;
}

// ─── Side-by-side pairing ─────────────────────────────────────────────────────

interface SidePair {
  hunkLine?: DiffLine;
  left?: DiffLine;  // del or ctx
  right?: DiffLine; // add or ctx
}

function toPairs(lines: DiffLine[]): SidePair[] {
  const pairs: SidePair[] = [];
  let dels: DiffLine[] = [];
  let adds: DiffLine[] = [];

  const flush = () => {
    const len = Math.max(dels.length, adds.length);
    for (let i = 0; i < len; i++) {
      pairs.push({ left: dels[i], right: adds[i] });
    }
    dels = [];
    adds = [];
  };

  for (const line of lines) {
    if (line.type === "hunk") {
      flush();
      pairs.push({ hunkLine: line });
    } else if (line.type === "ctx") {
      flush();
      pairs.push({ left: line, right: line });
    } else if (line.type === "del") {
      if (adds.length > 0) flush();
      dels.push(line);
    } else {
      adds.push(line);
    }
  }
  flush();
  return pairs;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

interface Theme {
  addBg: string;
  addFg: string;
  delBg: string;
  delFg: string;
  ctxBg: string;
  ctxFg: string;
  hunkBg: string;
  hunkFg: string;
  lnBg: string;
  lnFg: string;
  lnBorder: string;
  fileBg: string;
  fileFg: string;
  border: string;
  emptyBg: string;
}

const DARK: Theme = {
  addBg: "#1e3a1e",
  addFg: "#b5cea8",
  delBg: "#3a1e1e",
  delFg: "#f48771",
  ctxBg: "#1e1e1e",
  ctxFg: "#d4d4d4",
  hunkBg: "#2d2d30",
  hunkFg: "#569cd6",
  lnBg: "#1a1a1a",
  lnFg: "#636363",
  lnBorder: "#3e3e42",
  fileBg: "#252526",
  fileFg: "#ce9178",
  border: "#3e3e42",
  emptyBg: "#2a2a2a",
};

const LIGHT: Theme = {
  addBg: "#e6ffec",
  addFg: "#24292e",
  delBg: "#ffebe9",
  delFg: "#24292e",
  ctxBg: "#ffffff",
  ctxFg: "#24292e",
  hunkBg: "#ddeeff",
  hunkFg: "#0550ae",
  lnBg: "#f5f5f5",
  lnFg: "#999999",
  lnBorder: "#e0e0e0",
  fileBg: "#f0f0f0",
  fileFg: "#953800",
  border: "#dee2e6",
  emptyBg: "#f8f9fa",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = 'Consolas, Monaco, "Courier New", monospace';
const FS = 13;
const LH = 20;
const LN_W = 52;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBg(type: LineType, t: Theme): string {
  if (type === "add") return t.addBg;
  if (type === "del") return t.delBg;
  return t.ctxBg;
}

function getFg(type: LineType, t: Theme): string {
  if (type === "add") return t.addFg;
  if (type === "del") return t.delFg;
  return t.ctxFg;
}

function lnCellStyle(t: Theme, rowBg?: string): React.CSSProperties {
  return {
    width: LN_W,
    minWidth: LN_W,
    maxWidth: LN_W,
    padding: "0 6px",
    textAlign: "right",
    backgroundColor: rowBg ?? t.lnBg,
    color: rowBg && rowBg !== t.lnBg ? t.lnFg : t.lnFg,
    borderRight: `1px solid ${t.lnBorder}`,
    fontSize: 12,
    lineHeight: `${LH}px`,
    userSelect: "none",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  };
}

function hunkRowStyle(t: Theme): React.CSSProperties {
  return {
    backgroundColor: t.hunkBg,
    color: t.hunkFg,
    padding: "0 12px",
    fontSize: FS,
    lineHeight: `${LH}px`,
    whiteSpace: "pre",
    fontFamily: FONT,
  };
}

function codeCellStyle(
  bg: string,
  fg: string,
  borderRight?: string,
): React.CSSProperties {
  return {
    backgroundColor: bg,
    color: fg,
    padding: "0 8px",
    fontSize: FS,
    lineHeight: `${LH}px`,
    whiteSpace: "pre",
    fontFamily: FONT,
    verticalAlign: "top",
    ...(borderRight ? { borderRight } : {}),
  };
}

// ─── Row renderers ────────────────────────────────────────────────────────────

function renderLineByLine(
  lines: DiffLine[],
  t: Theme,
): React.ReactElement[] {
  return lines.map((line, i) => {
    if (line.type === "hunk") {
      return (
        <tr key={i}>
          <td colSpan={3} style={hunkRowStyle(t)}>
            {line.content}
          </td>
        </tr>
      );
    }
    const bg = getBg(line.type, t);
    const fg = getFg(line.type, t);
    const pfxColor =
      line.type === "add" ? t.addFg : line.type === "del" ? t.delFg : "transparent";
    const pfx = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
    // Color the line number cells the same as the code row so numbers stay
    // visually anchored — without this, del numbers appear in the left column
    // and add numbers in the right column, making them look like they jump.
    const lnBg = line.type === "ctx" ? t.lnBg : bg;
    return (
      <tr key={i}>
        <td style={lnCellStyle(t, lnBg)}>{line.oldNum ?? ""}</td>
        <td style={lnCellStyle(t, lnBg)}>{line.newNum ?? ""}</td>
        <td style={codeCellStyle(bg, fg)}>
          <span style={{ userSelect: "none", color: pfxColor }}>{pfx}</span>
          {line.content}
        </td>
      </tr>
    );
  });
}

function renderSideBySide(
  pairs: SidePair[],
  t: Theme,
): React.ReactElement[] {
  return pairs.map((pair, i) => {
    if (pair.hunkLine) {
      return (
        <tr key={i}>
          <td colSpan={4} style={hunkRowStyle(t)}>
            {pair.hunkLine.content}
          </td>
        </tr>
      );
    }
    const { left, right } = pair;
    const lBg = left ? getBg(left.type, t) : t.emptyBg;
    const lFg = left ? getFg(left.type, t) : t.ctxFg;
    const rBg = right ? getBg(right.type, t) : t.emptyBg;
    const rFg = right ? getFg(right.type, t) : t.ctxFg;
    const lLnBg = left?.type === "ctx" ? t.lnBg : lBg;
    const rLnBg = right?.type === "ctx" ? t.lnBg : rBg;
    return (
      <tr key={i}>
        <td style={lnCellStyle(t, lLnBg)}>{left?.oldNum ?? ""}</td>
        <td style={codeCellStyle(lBg, lFg, `1px solid ${t.border}`)}>
          {left?.content ?? ""}
        </td>
        <td style={lnCellStyle(t, rLnBg)}>{right?.newNum ?? ""}</td>
        <td style={codeCellStyle(rBg, rFg)}>
          {right?.content ?? ""}
        </td>
      </tr>
    );
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface DiffRendererProps {
  diffText: string;
  isDarkMode: boolean;
  viewMode: "side-by-side" | "line-by-line";
}

const DiffRenderer: React.FC<DiffRendererProps> = ({
  diffText,
  isDarkMode,
  viewMode,
}) => {
  const t = isDarkMode ? DARK : LIGHT;
  const files = useMemo(() => parseDiff(diffText), [diffText]);

  if (!files.length) return null;

  return (
    <div style={{ fontFamily: FONT }}>
      {files.map((file, fi) => {
        const isSbs = viewMode === "side-by-side";
        const pairs = isSbs ? toPairs(file.lines) : null;

        return (
          <div
            key={fi}
            style={{ marginBottom: fi < files.length - 1 ? 16 : 0 }}
          >
            {/* File path header */}
            <div
              style={{
                backgroundColor: t.fileBg,
                color: t.fileFg,
                padding: "5px 12px",
                fontSize: 13,
                fontWeight: 500,
                borderBottom: `1px solid ${t.border}`,
                fontFamily: FONT,
              }}
            >
              {file.path || "(unknown file)"}
            </div>

            {/* Diff table */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontFamily: FONT,
                }}
              >
                <colgroup>
                  <col style={{ width: LN_W }} />
                  {isSbs ? (
                    <>
                      <col />
                      <col style={{ width: LN_W }} />
                      <col />
                    </>
                  ) : (
                    <>
                      <col style={{ width: LN_W }} />
                      <col />
                    </>
                  )}
                </colgroup>
                <tbody>
                  {isSbs
                    ? renderSideBySide(pairs!, t)
                    : renderLineByLine(file.lines, t)}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DiffRenderer;
