# Merge Conflict Resolver (React)

A small, VS Code-inspired merge conflict resolver UI as a standalone React component.

This is designed to be copied into another app (no VS Code dependencies).

## What it does

- Parses Git-style conflict markers (default: `<<<<<<<`, `|||||||`, `=======`, `>>>>>>>`).
- Lets users navigate conflicts.
- Provides actions to accept Current, Incoming, or Both for a conflict.
- Updates the underlying document text by removing the markers and keeping the chosen content.

## Usage

```tsx
import React from 'react';
import { MergeConflictResolver } from './src';

export function App() {
	const [value, setValue] = React.useState<string>(`<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> branch\n`);

	return (
		<div style={{ height: 800 }}>
			<MergeConflictResolver
				value={value}
				onChange={setValue}
			/>
		</div>
	);
}
```

## Notes

- The component is controlled: you own the `value` state.
- Styling uses CSS variables and inherits colors; wire it into your design system as you like.
