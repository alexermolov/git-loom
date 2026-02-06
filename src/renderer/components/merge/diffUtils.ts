/*---------------------------------------------------------------------------------------------
 *  Diff utility functions for highlighting character/word-level differences
 *--------------------------------------------------------------------------------------------*/

export interface DiffSegment {
	readonly text: string;
	readonly type: 'equal' | 'insert' | 'delete';
}

export interface LineDiff {
	readonly lineNumber: number;
	readonly segments: DiffSegment[];
	readonly type: 'equal' | 'insert' | 'delete' | 'modified';
}

/**
 * Simple LCS-based diff algorithm for character-level comparison
 */
function computeLCS(a: string, b: string): number[][] {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	return dp;
}

/**
 * Compute character-level diff between two strings
 */
export function computeCharDiff(textA: string, textB: string): DiffSegment[] {
	if (textA === textB) {
		return [{ text: textA, type: 'equal' }];
	}

	const dp = computeLCS(textA, textB);
	const segments: DiffSegment[] = [];
	
	let i = textA.length;
	let j = textB.length;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && textA[i - 1] === textB[j - 1]) {
			segments.unshift({ text: textA[i - 1], type: 'equal' });
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			segments.unshift({ text: textB[j - 1], type: 'insert' });
			j--;
		} else if (i > 0) {
			segments.unshift({ text: textA[i - 1], type: 'delete' });
			i--;
		}
	}

	// Merge consecutive segments of the same type
	const merged: DiffSegment[] = [];
	for (const seg of segments) {
		const last = merged[merged.length - 1];
		if (last && last.type === seg.type) {
			merged[merged.length - 1] = { text: last.text + seg.text, type: seg.type };
		} else {
			merged.push(seg);
		}
	}

	return merged;
}

/**
 * Compute word-level diff between two strings
 */
export function computeWordDiff(textA: string, textB: string): DiffSegment[] {
	const wordsA = textA.match(/\S+|\s+/g) || [];
	const wordsB = textB.match(/\S+|\s+/g) || [];

	if (wordsA.length === 0 && wordsB.length === 0) {
		return [];
	}

	const dp = computeLCS(wordsA.join(''), wordsB.join(''));
	const segments: DiffSegment[] = [];
	
	let i = 0;
	let j = 0;

	while (i < wordsA.length || j < wordsB.length) {
		if (i < wordsA.length && j < wordsB.length && wordsA[i] === wordsB[j]) {
			segments.push({ text: wordsA[i], type: 'equal' });
			i++;
			j++;
		} else if (i < wordsA.length && j < wordsB.length) {
			// Words differ - do character-level diff
			const charDiff = computeCharDiff(wordsA[i], wordsB[j]);
			segments.push(...charDiff);
			i++;
			j++;
		} else if (j < wordsB.length) {
			segments.push({ text: wordsB[j], type: 'insert' });
			j++;
		} else if (i < wordsA.length) {
			segments.push({ text: wordsA[i], type: 'delete' });
			i++;
		}
	}

	return segments;
}

/**
 * Compare two texts line by line and compute diff
 */
export function computeLineDiff(currentText: string, incomingText: string): { current: LineDiff[], incoming: LineDiff[] } {
	const currentLines = currentText.split(/\r?\n/);
	const incomingLines = incomingText.split(/\r?\n/);

	const current: LineDiff[] = [];
	const incoming: LineDiff[] = [];

	const maxLines = Math.max(currentLines.length, incomingLines.length);

	for (let i = 0; i < maxLines; i++) {
		const currentLine = currentLines[i] || '';
		const incomingLine = incomingLines[i] || '';

		if (currentLine === incomingLine) {
			current.push({
				lineNumber: i + 1,
				segments: [{ text: currentLine, type: 'equal' }],
				type: 'equal',
			});
			incoming.push({
				lineNumber: i + 1,
				segments: [{ text: incomingLine, type: 'equal' }],
				type: 'equal',
			});
		} else {
			// Lines differ
			const segments = computeWordDiff(currentLine, incomingLine);
			
			const currentSegments: DiffSegment[] = segments.map(seg => 
				seg.type === 'insert' ? { ...seg, type: 'equal' as const, text: '' } : seg
			).filter(seg => seg.text);
			
			const incomingSegments: DiffSegment[] = segments.map(seg => 
				seg.type === 'delete' ? { ...seg, type: 'equal' as const, text: '' } : seg
			).filter(seg => seg.text);

			current.push({
				lineNumber: i + 1,
				segments: currentSegments.length > 0 ? currentSegments : [{ text: currentLine, type: 'delete' }],
				type: currentLines[i] === undefined ? 'equal' : (incomingLines[i] === undefined ? 'delete' : 'modified'),
			});

			incoming.push({
				lineNumber: i + 1,
				segments: incomingSegments.length > 0 ? incomingSegments : [{ text: incomingLine, type: 'insert' }],
				type: incomingLines[i] === undefined ? 'equal' : (currentLines[i] === undefined ? 'insert' : 'modified'),
			});
		}
	}

	return { current, incoming };
}
