/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MergeConflict, MergeSide } from './mergeConflictTypes';

function isNewlineOnly(text: string): boolean {
	return text === '\n' || text === '\r\n';
}

export function applyConflictResolution(text: string, conflict: MergeConflict, side: MergeSide): string {
	let replacement = '';
	if (side === 'current') {
		replacement = conflict.current.contentText;
	} else if (side === 'incoming') {
		replacement = conflict.incoming.contentText;
	} else {
		replacement = conflict.current.contentText + conflict.incoming.contentText;
	}

	if (isNewlineOnly(replacement)) {
		replacement = '';
	}

	return text.substring(0, conflict.conflictOffsetStart)
		+ replacement
		+ text.substring(conflict.conflictOffsetEndExclusive);
}

export function applyAllConflicts(text: string, conflicts: readonly MergeConflict[], side: MergeSide): string {
	// Apply from the end so offsets stay valid.
	const ordered = [...conflicts].sort((a, b) => b.conflictOffsetStart - a.conflictOffsetStart);
	let result = text;
	for (const c of ordered) {
		result = applyConflictResolution(result, c, side);
	}
	return result;
}
