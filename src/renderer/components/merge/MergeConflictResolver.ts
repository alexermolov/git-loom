/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { applyAllConflicts, applyConflictResolution } from './mergeConflictEdits';
import { defaultMergeConflictMarkerConfig, MergeConflict, MergeConflictMarkerConfig, MergeSide } from './mergeConflictTypes';
import { parseMergeConflicts } from './mergeConflictParser';
import { computeLineDiff, LineDiff, DiffSegment } from './diffUtils';
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
}

const defaultLabels: MergeConflictResolverLabels = {
	current: 'Current',
	incoming: 'Incoming',
	commonAncestors: 'Common Ancestors',
	document: 'Document',
	conflicts: count => `Conflicts: ${count}`,
	prev: 'Prev',
	next: 'Next',
	acceptCurrent: 'Accept Current',
	acceptIncoming: 'Accept Incoming',
	acceptBoth: 'Accept Both',
	acceptAllCurrent: 'Accept All Current',
	acceptAllIncoming: 'Accept All Incoming',
	splitView: 'Split View',
	inlineView: 'Inline View',
	compareChanges: 'Compare Changes',
	acceptAllBoth: 'Accept All Both',
	malformedWarning: 'Malformed conflict markers detected. Some conflicts might not be parsed.',
};

function mergeMarkerConfig(partial?: Partial<MergeConflictMarkerConfig>): MergeConflictMarkerConfig {
	return {
		...defaultMergeConflictMarkerConfig,
		...(partial ?? {}),
	};
}

export function MergeConflictResolver(props: MergeConflictResolverProps) {
	const labels = { ...defaultLabels, ...(props.labels ?? {}) };
	const markerConfig = React.useMemo(() => mergeMarkerConfig(props.markerConfig), [props.markerConfig]);

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
			React.createElement('div', { key: 'count', className: 'mcr-toolbar-section' }, labels.conflicts(conflicts.length)),
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
			React.createElement('span', { key: 'spacer', style: { flex: 1 } }),
			
			React.createElement('div', { key: 'view-mode', className: 'mcr-toolbar-section' },
				React.createElement(
					'button',
					{ 
						key: 'split', 
						onClick: () => setViewMode('split'), 
						className: viewMode === 'split' ? 'mcr-active' : '',
						title: labels.splitView,
					},
					'⬌ Split',
				),
				React.createElement(
					'button',
					{ 
						key: 'inline', 
						onClick: () => setViewMode('inline'), 
						className: viewMode === 'inline' ? 'mcr-active' : '',
						title: labels.inlineView,
					},
					'☰ Inline',
				),
			),
			
			React.createElement('span', { key: 'spacer2', style: { flex: 1 } }),
			
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
			React.createElement(
				'button',
				{ key: 'aac', onClick: () => resolveAll('current'), disabled: conflicts.length === 0, title: labels.acceptAllCurrent },
				'All Current',
			),
			React.createElement(
				'button',
				{ key: 'aai', onClick: () => resolveAll('incoming'), disabled: conflicts.length === 0, title: labels.acceptAllIncoming },
				'All Incoming',
			),
			React.createElement(
				'button',
				{ key: 'aab', onClick: () => resolveAll('both'), disabled: conflicts.length === 0, title: labels.acceptAllBoth },
				'All Both',
			),
		),
	);

	if (parseResult.malformed) {
		rootChildren.push(
			React.createElement('div', { className: 'mcr-toolbar mcr-warning', role: 'alert', key: 'malformed' }, 
				'⚠ ' + labels.malformedWarning),
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
						if (seg.type === 'equal') {
							return React.createElement('span', { key: segIdx, className: 'mcr-segment-equal' }, seg.text);
						} else if (seg.type === 'insert') {
							return React.createElement('span', { key: segIdx, className: 'mcr-segment-insert' }, seg.text);
						} else {
							return React.createElement('span', { key: segIdx, className: 'mcr-segment-delete' }, seg.text);
						}
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
			props.readOnlyDocument
				? React.createElement('pre', { className: 'mcr-pre' }, props.value)
				: React.createElement('textarea', {
					className: 'mcr-document',
					value: props.value,
					onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value),
					spellCheck: false,
				}),
		),
	);

	return React.createElement('div', { className: 'mcr-root' }, rootChildren);
}
