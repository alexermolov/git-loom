/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { applyAllConflicts, applyConflictResolution } from './mergeConflictEdits';
import { defaultMergeConflictMarkerConfig, MergeConflict, MergeConflictMarkerConfig, MergeSide } from './mergeConflictTypes';
import { parseMergeConflicts } from './mergeConflictParser';
import './mergeConflictResolver.css';

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
}

export interface MergeConflictResolverProps {
	readonly value: string;
	readonly onChange: (nextValue: string) => void;
	readonly markerConfig?: Partial<MergeConflictMarkerConfig>;
	readonly labels?: Partial<MergeConflictResolverLabels>;
	readonly readOnlyDocument?: boolean;
	readonly showCommonAncestors?: boolean;
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

	const rootChildren: React.ReactNode[] = [];

	rootChildren.push(
		React.createElement('div', { className: 'mcr-toolbar', key: 'toolbar' },
			React.createElement('div', { key: 'count' }, labels.conflicts(conflicts.length)),
			React.createElement(
				'button',
				{ key: 'prev', onClick: () => setActiveIndex((i: number) => Math.max(0, i - 1)), disabled: !canGoPrev },
				labels.prev,
			),
			React.createElement(
				'button',
				{ key: 'next', onClick: () => setActiveIndex((i: number) => Math.min(conflicts.length - 1, i + 1)), disabled: !canGoNext },
				labels.next,
			),
			React.createElement('span', { key: 'spacer', style: { flex: 1 } }),
			React.createElement(
				'button',
				{ key: 'ac', onClick: () => resolveOne('current'), disabled: !activeConflict },
				labels.acceptCurrent,
			),
			React.createElement(
				'button',
				{ key: 'ai', onClick: () => resolveOne('incoming'), disabled: !activeConflict },
				labels.acceptIncoming,
			),
			React.createElement(
				'button',
				{ key: 'ab', onClick: () => resolveOne('both'), disabled: !activeConflict },
				labels.acceptBoth,
			),
			React.createElement(
				'button',
				{ key: 'aac', onClick: () => resolveAll('current'), disabled: conflicts.length === 0 },
				labels.acceptAllCurrent,
			),
			React.createElement(
				'button',
				{ key: 'aai', onClick: () => resolveAll('incoming'), disabled: conflicts.length === 0 },
				labels.acceptAllIncoming,
			),
			React.createElement(
				'button',
				{ key: 'aab', onClick: () => resolveAll('both'), disabled: conflicts.length === 0 },
				labels.acceptAllBoth,
			),
		),
	);

	if (parseResult.malformed) {
		rootChildren.push(
			React.createElement('div', { className: 'mcr-toolbar', role: 'alert', key: 'malformed' }, labels.malformedWarning),
		);
	}

	rootChildren.push(
		React.createElement('div', { className: 'mcr-main', key: 'main' },
			React.createElement('div', { className: 'mcr-pane', key: 'current' },
				React.createElement('div', { className: 'mcr-paneHeader' }, labels.current),
				React.createElement('pre', { className: 'mcr-pre' }, activeConflict?.current.contentText ?? ''),
			),
			React.createElement('div', { className: 'mcr-pane', key: 'incoming' },
				React.createElement('div', { className: 'mcr-paneHeader' }, labels.incoming),
				React.createElement('pre', { className: 'mcr-pre' }, activeConflict?.incoming.contentText ?? ''),
			),
		),
	);

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
