/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type MergeSide = 'current' | 'incoming' | 'both';

export interface MergeConflictMarkerConfig {
	startHeaderMarker: string;
	commonAncestorsMarker: string;
	splitterMarker: string;
	endFooterMarker: string;
}

export const defaultMergeConflictMarkerConfig: MergeConflictMarkerConfig = {
	startHeaderMarker: '<<<<<<<',
	commonAncestorsMarker: '|||||||',
	splitterMarker: '=======',
	endFooterMarker: '>>>>>>>',
};

export interface LineInfo {
	readonly lineNumber: number;
	readonly text: string;
	readonly startOffset: number;
	readonly endOffsetExclusive: number;
	readonly endOffsetIncludingLineBreak: number;
	readonly lineBreak: '' | '\n' | '\r\n';
}

export interface MergeRegion {
	readonly name: string;	// branch/ref name after marker
	readonly contentOffsetStart: number;
	readonly contentOffsetEndExclusive: number;
	readonly contentText: string;
}

export interface MergeConflict {
	readonly id: string;
	readonly conflictOffsetStart: number;
	readonly conflictOffsetEndExclusive: number;
	readonly current: MergeRegion;
	readonly incoming: MergeRegion;
	readonly commonAncestors: MergeRegion[];
}

export interface MergeConflictParseResult {
	readonly conflicts: MergeConflict[];
	readonly malformed: boolean;
}
