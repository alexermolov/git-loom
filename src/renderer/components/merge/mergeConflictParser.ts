/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defaultMergeConflictMarkerConfig, LineInfo, MergeConflict, MergeConflictMarkerConfig, MergeConflictParseResult, MergeRegion } from './mergeConflictTypes';

function computeLines(text: string): LineInfo[] {
	const result: LineInfo[] = [];
	let offset = 0;
	let lineNumber = 0;

	while (offset <= text.length) {
		const nextNewlineIdx = text.indexOf('\n', offset);
		if (nextNewlineIdx === -1) {
			const lineText = text.substring(offset);
			result.push({
				lineNumber,
				text: lineText,
				startOffset: offset,
				endOffsetExclusive: text.length,
				endOffsetIncludingLineBreak: text.length,
				lineBreak: '',
			});
			break;
		}

		const lineBreakStart = nextNewlineIdx;
		const hasCarriageReturn = lineBreakStart > offset && text.charAt(lineBreakStart - 1) === '\r';
		const lineEndExclusive = hasCarriageReturn ? lineBreakStart - 1 : lineBreakStart;
		const lineBreak = hasCarriageReturn ? '\r\n' : '\n';
		const lineText = text.substring(offset, lineEndExclusive);

		result.push({
			lineNumber,
			text: lineText,
			startOffset: offset,
			endOffsetExclusive: lineEndExclusive,
			endOffsetIncludingLineBreak: nextNewlineIdx + 1,
			lineBreak,
		});

		offset = nextNewlineIdx + 1;
		lineNumber++;
	}

	return result;
}

function shiftBackOneCharacter(text: string, offset: number, unlessEqual: number): number {
	if (offset === unlessEqual) {
		return offset;
	}
	if (offset <= 0) {
		return 0;
	}
	return offset - 1;
}

export function parseMergeConflicts(
	text: string,
	markerConfig: MergeConflictMarkerConfig = defaultMergeConflictMarkerConfig,
): MergeConflictParseResult {
	const lines = computeLines(text);

	type ScanConflict = {
		startHeader: LineInfo;
		commonAncestors: LineInfo[];
		splitter?: LineInfo;
		endFooter?: LineInfo;
	};

	let malformed = false;
	let currentConflict: ScanConflict | undefined;
	const conflicts: MergeConflict[] = [];

	for (const line of lines) {
		if (!line.text || line.text.trim().length === 0) {
			continue;
		}

		if (line.text.startsWith(markerConfig.startHeaderMarker)) {
			if (currentConflict) {
				malformed = true;
				currentConflict = undefined;
				break;
			}
			currentConflict = { startHeader: line, commonAncestors: [] };
			continue;
		}

		if (!currentConflict) {
			continue;
		}

		if (!currentConflict.splitter && line.text.startsWith(markerConfig.commonAncestorsMarker)) {
			currentConflict.commonAncestors.push(line);
			continue;
		}

		if (!currentConflict.splitter && line.text === markerConfig.splitterMarker) {
			currentConflict.splitter = line;
			continue;
		}

		if (line.text.startsWith(markerConfig.endFooterMarker)) {
			currentConflict.endFooter = line;
			const complete = toConflict(text, markerConfig, currentConflict);
			if (complete) {
				conflicts.push(complete);
			} else {
				malformed = true;
			}
			currentConflict = undefined;
			continue;
		}
	}

	if (currentConflict) {
		malformed = true;
	}

	return { conflicts, malformed };
}

function toConflict(text: string, markerConfig: MergeConflictMarkerConfig, scanned: {
	startHeader: LineInfo;
	commonAncestors: LineInfo[];
	splitter?: LineInfo;
	endFooter?: LineInfo;
}): MergeConflict | undefined {
	if (!scanned.splitter || !scanned.endFooter) {
		return undefined;
	}

	const tokenAfterCurrentBlock = scanned.commonAncestors[0] ?? scanned.splitter;

	const currentName = scanned.startHeader.text.substring(markerConfig.startHeaderMarker.length + 1);
	const incomingName = scanned.endFooter.text.substring(markerConfig.endFooterMarker.length + 1);

	const currentContentStart = scanned.startHeader.endOffsetIncludingLineBreak;
	const currentContentEnd = tokenAfterCurrentBlock.startOffset;

	const incomingContentStart = scanned.splitter.endOffsetIncludingLineBreak;
	const incomingContentEnd = scanned.endFooter.startOffset;

	const conflictOffsetStart = scanned.startHeader.startOffset;
	const conflictOffsetEndExclusive = scanned.endFooter.endOffsetIncludingLineBreak;

	const currentRegion: MergeRegion = {
		name: currentName,
		contentOffsetStart: currentContentStart,
		contentOffsetEndExclusive: shiftBackOneCharacter(text, currentContentEnd, currentContentStart),
		contentText: text.substring(currentContentStart, currentContentEnd),
	};

	const incomingRegion: MergeRegion = {
		name: incomingName,
		contentOffsetStart: incomingContentStart,
		contentOffsetEndExclusive: shiftBackOneCharacter(text, incomingContentEnd, incomingContentStart),
		contentText: text.substring(incomingContentStart, incomingContentEnd),
	};

	const commonAncestors: MergeRegion[] = scanned.commonAncestors.map((line, idx, arr) => {
		const next = arr[idx + 1] ?? scanned.splitter!;
		const contentStart = line.endOffsetIncludingLineBreak;
		const contentEnd = next.startOffset;
		return {
			name: line.text.substring(markerConfig.commonAncestorsMarker.length + 1),
			contentOffsetStart: contentStart,
			contentOffsetEndExclusive: shiftBackOneCharacter(text, contentEnd, contentStart),
			contentText: text.substring(contentStart, contentEnd),
		};
	});

	const id = `${conflictOffsetStart}:${conflictOffsetEndExclusive}`;

	return {
		id,
		conflictOffsetStart,
		conflictOffsetEndExclusive,
		current: currentRegion,
		incoming: incomingRegion,
		commonAncestors,
	};
}
