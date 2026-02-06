/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { applyAllConflicts, applyConflictResolution } from './mergeConflictEdits';
import { defaultMergeConflictMarkerConfig, MergeConflict, MergeConflictMarkerConfig, MergeSide } from './mergeConflictTypes';
import { parseMergeConflicts } from './mergeConflictParser';
import { computeLineDiff, LineDiff, DiffSegment } from './diffUtils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './mergeConflictResolver.css';

type ViewMode = 'split' | 'inline';

export interface MergeConflictResolverLabels {
	readonly current: string;
	readonly incoming: string;
	readonly commonAncestors: string;
	readonly document: string;
	readonly conflicts: (count: number) => string;
	readonly prev: string;
	readonly next: string;
	readonly acceptCurrent: string;
	readonly acceptIncoming: string;
	readonly acceptBoth: string;
	readonly acceptAllCurrent: string;
	readonly acceptAllIncoming: string;
	readonly acceptAllBoth: string;
	readonly malformedWarning: string;
	readonly splitView: string;
	readonly inlineView: string;
	readonly compareChanges: string;
}

export interface MergeConflictResolverProps {
	readonly value: string;
	readonly onChange: (nextValue: string) => void;
	readonly markerConfig?: Partial<MergeConflictMarkerConfig>;
	readonly labels?: Partial<MergeConflictResolverLabels>;
	readonly readOnlyDocument?: boolean;
	readonly showCommonAncestors?: boolean;
	readonly defaultViewMode?: ViewMode;
	readonly showLineNumbers?: boolean;
	readonly filePath?: string;
	readonly language?: string;
	readonly isDarkMode?: boolean;
	readonly syntaxHighlight?: boolean;
}

const defaultLabels: MergeConflictResolverLabels = {
	current: 'Current',
	incoming: 'Incoming',
	commonAncestors: 'Common Ancestors',
	document: 'Document',
	conflicts: count => `${count} conflict${count !== 1 ? 's' : ''}`,
	prev: 'Prev',
	next: 'Next',
	acceptCurrent: '✓ Current',
	acceptIncoming: '✓ Incoming',
	acceptBoth: '✓ Both',
	acceptAllCurrent: 'All ✓ Cur',
	acceptAllIncoming: 'All ✓ Inc',
	splitView: 'Split',
	inlineView: 'Inline',
	compareChanges: 'Compare',
	acceptAllBoth: 'All ✓ Both',
	malformedWarning: '⚠ Malformed markers detected',
};

function mergeMarkerConfig(partial?: Partial<MergeConflictMarkerConfig>): MergeConflictMarkerConfig {
	return {
		...defaultMergeConflictMarkerConfig,
		...(partial ?? {}),
	};
}

function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() || '';
	const langMap: Record<string, string> = {
		js: 'javascript',
		jsx: 'jsx',
		ts: 'typescript',
		tsx: 'tsx',
		py: 'python',
		java: 'java',
		cpp: 'cpp',
		c: 'c',
		cs: 'csharp',
		go: 'go',
		rs: 'rust',
		rb: 'ruby',
		php: 'php',
		html: 'html',
		css: 'css',
		scss: 'scss',
		json: 'json',
		xml: 'xml',
		yaml: 'yaml',
		yml: 'yaml',
		md: 'markdown',
		sh: 'bash',
		sql: 'sql',
	};
	return langMap[ext] || 'text';
}

export function MergeConflictResolver(props: MergeConflictResolverProps) {
	const labels = { ...defaultLabels, ...(props.labels ?? {}) };
	const markerConfig = React.useMemo(() => mergeMarkerConfig(props.markerConfig), [props.markerConfig]);
	const isDarkMode = props.isDarkMode === true;
	const syntaxHighlight = props.syntaxHighlight !== false;
	const language = React.useMemo(() => {
		if (props.language && props.language.trim().length > 0) {
			return props.language;
		}
		if (props.filePath) {
			return getLanguageFromPath(props.filePath);
		}
		return 'text';
	}, [props.language, props.filePath]);

	const documentEditorRef = React.useRef<HTMLTextAreaElement | null>(null);
	const documentHighlightRef = React.useRef<HTMLDivElement | null>(null);

	const syncDocumentScroll = React.useCallback(() => {
		const editorEl = documentEditorRef.current;
		const highlightEl = documentHighlightRef.current;
		if (!editorEl || !highlightEl) {
			return;
		}
		highlightEl.scrollTop = editorEl.scrollTop;
		highlightEl.scrollLeft = editorEl.scrollLeft;
	}, []);

	let documentBody: React.ReactNode;
	if (props.readOnlyDocument) {
		if (syntaxHighlight && language !== 'text') {
			documentBody = React.createElement(
				SyntaxHighlighter as any,
				{
					language,
					style: isDarkMode ? vscDarkPlus : vs,
					showLineNumbers: false,
					wrapLongLines: false,
					customStyle: {
						margin: 0,
						background: 'transparent',
						padding: 4,
						fontSize: 12,
						lineHeight: 1.3,
					},
					PreTag: 'pre',
					CodeTag: 'code',
					className: 'mcr-pre',
				},
				props.value,
			);
		} else {
			documentBody = React.createElement('pre', { className: 'mcr-pre' }, props.value);
		}
	} else {
		if (syntaxHighlight && language !== 'text') {
			documentBody = React.createElement(
				'div',
				{ className: 'mcr-document-container' },
				React.createElement(
					'div',
					{ className: 'mcr-document mcr-document-highlight', ref: documentHighlightRef },
					React.createElement(
						SyntaxHighlighter as any,
						{
							language,
							style: isDarkMode ? vscDarkPlus : vs,
							showLineNumbers: false,
							wrapLongLines: false,
							customStyle: {
								margin: 0,
								background: 'transparent',
								padding: 0,
								overflow: 'visible',
								fontSize: 'inherit',
								lineHeight: 'inherit',
							},
							PreTag: 'pre',
							CodeTag: 'code',
						},
						props.value,
					),
				),
				React.createElement('textarea', {
					ref: documentEditorRef,
					className: 'mcr-document mcr-document-editor',
					value: props.value,
					onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value),
					onScroll: syncDocumentScroll,
					spellCheck: false,
				}),
			);
		} else {
			documentBody = React.createElement('textarea', {
				className: 'mcr-document',
				value: props.value,
				onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value),
				spellCheck: false,
			});
		}
	}

	const parseResult = React.useMemo(() => parseMergeConflicts(props.value, markerConfig), [props.value, markerConfig]);
	const conflicts = parseResult.conflicts;

	const [activeIndex, setActiveIndex] = React.useState(0);
	const [viewMode, setViewMode] = React.useState<ViewMode>(props.defaultViewMode || 'split');
	const showLineNumbers = props.showLineNumbers !== false;

	React.useEffect(() => {
		if (conflicts.length === 0) {
			setActiveIndex(0);
			return;
		}
		if (activeIndex >= conflicts.length) {
			setActiveIndex(conflicts.length - 1);
		}
	}, [conflicts.length, activeIndex]);

	const activeConflict: MergeConflict | undefined = conflicts[activeIndex];

	// Compute diff for active conflict
	const diffInfo = React.useMemo(() => {
		if (!activeConflict) {
			return null;
		}
		return computeLineDiff(activeConflict.current.contentText, activeConflict.incoming.contentText);
	}, [activeConflict]);

	const canGoPrev = conflicts.length > 0 && activeIndex > 0;
	const canGoNext = conflicts.length > 0 && activeIndex < conflicts.length - 1;

	const resolveOne = React.useCallback((side: MergeSide) => {
		if (!activeConflict) {
			return;
		}
		props.onChange(applyConflictResolution(props.value, activeConflict, side));
	}, [props, activeConflict]);

	const resolveAll = React.useCallback((side: MergeSide) => {
		if (conflicts.length === 0) {
			return;
		}
		props.onChange(applyAllConflicts(props.value, conflicts, side));
	}, [props, conflicts]);

	// Keyboard shortcuts
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Alt+C - Accept Current
			if (e.altKey && e.key === 'c') {
				e.preventDefault();
				resolveOne('current');
			}
			// Alt+I - Accept Incoming
			if (e.altKey && e.key === 'i') {
				e.preventDefault();
				resolveOne('incoming');
			}
			// Alt+B - Accept Both
			if (e.altKey && e.key === 'b') {
				e.preventDefault();
				resolveOne('both');
			}
			// Alt+[ - Previous conflict
			if (e.altKey && e.key === '[') {
				e.preventDefault();
				if (canGoPrev) {
					setActiveIndex(i => Math.max(0, i - 1));
				}
			}
			// Alt+] - Next conflict
			if (e.altKey && e.key === ']') {
				e.preventDefault();
				if (canGoNext) {
					setActiveIndex(i => Math.min(conflicts.length - 1, i + 1));
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [resolveOne, canGoPrev, canGoNext, conflicts.length]);

	const rootChildren: React.ReactNode[] = [];

	rootChildren.push(
		React.createElement('div', { className: 'mcr-toolbar', key: 'toolbar' },
			// Conflict navigation
			React.createElement('div', { key: 'nav', className: 'mcr-toolbar-section' },
				React.createElement('span', { key: 'count', style: { marginRight: '4px' } }, labels.conflicts(conflicts.length)),
				React.createElement(
					'button',
					{ key: 'prev', onClick: () => setActiveIndex((i: number) => Math.max(0, i - 1)), disabled: !canGoPrev, title: 'Previous Conflict (Alt+[)' },
					'◀',
				),
				React.createElement(
					'button',
					{ key: 'next', onClick: () => setActiveIndex((i: number) => Math.min(conflicts.length - 1, i + 1)), disabled: !canGoNext, title: 'Next Conflict (Alt+])' },
					'▶',
				),
			),
			
			// View mode
			React.createElement('div', { key: 'view-mode', className: 'mcr-toolbar-section' },
				React.createElement(
					'button',
					{ 
						key: 'split', 
						onClick: () => setViewMode('split'), 
						className: viewMode === 'split' ? 'mcr-active' : '',
						title: 'Split View',
					},
					'⬌',
				),
				React.createElement(
					'button',
					{ 
						key: 'inline', 
						onClick: () => setViewMode('inline'), 
						className: viewMode === 'inline' ? 'mcr-active' : '',
						title: 'Inline View',
					},
					'☰',
				),
			),
			
			React.createElement('span', { key: 'spacer', style: { flex: 1 } }),
			
			// Single conflict actions
			React.createElement('div', { key: 'single', className: 'mcr-toolbar-section' },
				React.createElement(
					'button',
					{ key: 'ac', onClick: () => resolveOne('current'), disabled: !activeConflict, className: 'mcr-action-current', title: 'Accept Current (Alt+C)' },
					labels.acceptCurrent,
				),
				React.createElement(
					'button',
					{ key: 'ai', onClick: () => resolveOne('incoming'), disabled: !activeConflict, className: 'mcr-action-incoming', title: 'Accept Incoming (Alt+I)' },
					labels.acceptIncoming,
				),
				React.createElement(
					'button',
					{ key: 'ab', onClick: () => resolveOne('both'), disabled: !activeConflict, className: 'mcr-action-both', title: 'Accept Both (Alt+B)' },
					labels.acceptBoth,
				),
			),
			
			// All conflicts actions
			React.createElement('div', { key: 'all', className: 'mcr-toolbar-section' },
				React.createElement(
					'button',
					{ key: 'aac', onClick: () => resolveAll('current'), disabled: conflicts.length === 0, className: 'mcr-action-current', title: labels.acceptAllCurrent },
					labels.acceptAllCurrent,
				),
				React.createElement(
					'button',
					{ key: 'aai', onClick: () => resolveAll('incoming'), disabled: conflicts.length === 0, className: 'mcr-action-incoming', title: labels.acceptAllIncoming },
					labels.acceptAllIncoming,
				),
				React.createElement(
					'button',
					{ key: 'aab', onClick: () => resolveAll('both'), disabled: conflicts.length === 0, className: 'mcr-action-both', title: labels.acceptAllBoth },
					labels.acceptAllBoth,
				),
			),
		),
	);

	if (parseResult.malformed) {
		rootChildren.push(
			React.createElement('div', { className: 'mcr-toolbar mcr-warning', role: 'alert', key: 'malformed' }, 
				labels.malformedWarning),
		);
	}

	// Helper to render diff lines with line numbers and highlighting
	const renderDiffLines = (lines: LineDiff[], side: 'current' | 'incoming') => {
		return lines.map((line, idx) => {
			const lineClassName = `mcr-line mcr-line-${line.type} mcr-line-${side}`;
			
			return React.createElement('div', { key: idx, className: lineClassName },
				showLineNumbers && React.createElement('span', { className: 'mcr-line-number' }, line.lineNumber),
				React.createElement('div', { className: 'mcr-line-content' },
					...line.segments.map((seg, segIdx) => {
						const segClassName = seg.type === 'equal'
							? 'mcr-segment-equal'
							: seg.type === 'insert'
								? 'mcr-segment-insert'
								: 'mcr-segment-delete';

						if (!syntaxHighlight || language === 'text') {
							return React.createElement('span', { key: segIdx, className: segClassName }, seg.text);
						}

						// Highlight each segment inline. This keeps our diff/segment styling while adding syntax colors.
						return React.createElement(
							'span',
							{ key: segIdx, className: segClassName },
							React.createElement(
								SyntaxHighlighter as any,
								{
									language,
									style: isDarkMode ? vscDarkPlus : vs,
									PreTag: 'span',
									CodeTag: 'span',
									customStyle: { background: 'transparent', padding: 0, margin: 0 },
									showLineNumbers: false,
									wrapLongLines: false,
								},
								seg.text,
							),
						);
					}),
				),
			);
		});
	};

	if (viewMode === 'split') {
		rootChildren.push(
			React.createElement('div', { className: 'mcr-main mcr-split-view', key: 'main' },
				React.createElement('div', { className: 'mcr-pane mcr-pane-current', key: 'current' },
					React.createElement('div', { className: 'mcr-paneHeader' }, 
						labels.current,
						activeConflict?.current.name && React.createElement('span', { className: 'mcr-branch-name' }, ` (${activeConflict.current.name})`),
					),
					React.createElement('div', { className: 'mcr-code-view' },
						diffInfo ? renderDiffLines(diffInfo.current, 'current') : 
							React.createElement('pre', { className: 'mcr-pre' }, activeConflict?.current.contentText ?? ''),
					),
				),
				React.createElement('div', { className: 'mcr-pane mcr-pane-incoming', key: 'incoming' },
					React.createElement('div', { className: 'mcr-paneHeader' }, 
						labels.incoming,
						activeConflict?.incoming.name && React.createElement('span', { className: 'mcr-branch-name' }, ` (${activeConflict.incoming.name})`),
					),
					React.createElement('div', { className: 'mcr-code-view' },
						diffInfo ? renderDiffLines(diffInfo.incoming, 'incoming') : 
							React.createElement('pre', { className: 'mcr-pre' }, activeConflict?.incoming.contentText ?? ''),
					),
				),
			),
		);
	} else {
		// Inline view
		rootChildren.push(
			React.createElement('div', { className: 'mcr-main mcr-inline-view', key: 'main' },
				React.createElement('div', { className: 'mcr-pane mcr-pane-full', key: 'inline' },
					React.createElement('div', { className: 'mcr-paneHeader' }, labels.compareChanges),
					React.createElement('div', { className: 'mcr-code-view mcr-inline-diff' },
						diffInfo && React.createElement('div', { className: 'mcr-inline-container' },
							React.createElement('div', { className: 'mcr-inline-section mcr-inline-current' },
								React.createElement('div', { className: 'mcr-inline-label' }, 
									labels.current,
									activeConflict?.current.name && React.createElement('span', { className: 'mcr-branch-name' }, ` (${activeConflict.current.name})`),
								),
								...renderDiffLines(diffInfo.current, 'current'),
							),
							React.createElement('div', { className: 'mcr-inline-divider' }),
							React.createElement('div', { className: 'mcr-inline-section mcr-inline-incoming' },
								React.createElement('div', { className: 'mcr-inline-label' }, 
									labels.incoming,
									activeConflict?.incoming.name && React.createElement('span', { className: 'mcr-branch-name' }, ` (${activeConflict.incoming.name})`),
								),
								...renderDiffLines(diffInfo.incoming, 'incoming'),
							),
						),
					),
				),
			),
		);
	}

	if (props.showCommonAncestors !== false && activeConflict?.commonAncestors?.length) {
		rootChildren.push(
			React.createElement('div', { className: 'mcr-pane', key: 'ancestors' },
				React.createElement('div', { className: 'mcr-paneHeader' }, labels.commonAncestors),
				React.createElement(
					'pre',
					{ className: 'mcr-pre' },
					activeConflict.commonAncestors.map((a, i) => {
						const header = a.name ? `${a.name}\n` : '';
						return `${i ? '\n' : ''}${header}${a.contentText}`;
					}).join(''),
				),
			),
		);
	}

	rootChildren.push(
		React.createElement('div', { className: 'mcr-pane', key: 'document' },
			React.createElement('div', { className: 'mcr-paneHeader' }, labels.document),
			documentBody,
		),
	);

	return React.createElement('div', { className: 'mcr-root' }, rootChildren);
}
