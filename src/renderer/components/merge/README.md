# Merge Conflict Resolver (React)

A modern, VS Code-inspired merge conflict resolver UI as a standalone React component.

This is designed to be copied into another app (no VS Code dependencies).

## Features

### 🎨 Visual Improvements (VS Code-inspired)

- **Split & Inline Views**: Toggle between side-by-side comparison and inline diff view
- **Line Numbers**: Shows line numbers for better orientation in code
- **Word-level Diff Highlighting**: Precise highlighting of changed characters/words within lines
- **Color-coded Changes**: 
  - 🔵 Current changes (blue/teal)
  - 🟢 Incoming changes (green/blue)
  - 🔴 Deletions (red)
  - 🟢 Insertions (green)
- **Branch Names**: Displays branch/ref names in headers

### ⌨️ Keyboard Shortcuts

- `Alt+C` - Accept Current
- `Alt+I` - Accept Incoming  
- `Alt+B` - Accept Both
- `Alt+[` - Previous Conflict
- `Alt+]` - Next Conflict

### 🔧 Core Functionality

- Parses Git-style conflict markers (default: `<<<<<<<`, `|||||||`, `=======`, `>>>>>>>`)
- Navigation between multiple conflicts
- Actions to accept Current, Incoming, or Both for each conflict
- Batch operations (Accept All Current/Incoming/Both)
- Updates the underlying document text by removing markers and keeping chosen content

## Usage

```tsx
import React from 'react';
import { MergeConflictResolver } from './src';

export function App() {
	const [value, setValue] = React.useState<string>(`<<<<<<< HEAD
function hello() {
	console.log("Hello from main");
}
=======
function hello() {
	console.log("Hello from feature");
}
>>>>>>> feature-branch
`);

	return (
		<div style={{ height: 800 }}>
			<MergeConflictResolver
				value={value}
				onChange={setValue}
				showLineNumbers={true}
				defaultViewMode="split"
			/>
		</div>
	);
}
```

## Props

### `MergeConflictResolverProps`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `value` | `string` | **required** | The document text containing conflict markers |
| `onChange` | `(value: string) => void` | **required** | Callback when conflicts are resolved |
| `markerConfig` | `Partial<MergeConflictMarkerConfig>` | `undefined` | Custom conflict markers configuration |
| `labels` | `Partial<MergeConflictResolverLabels>` | `undefined` | Custom UI labels for internationalization |
| `readOnlyDocument` | `boolean` | `false` | Make the document pane read-only |
| `showCommonAncestors` | `boolean` | `true` | Show common ancestor sections |
| `defaultViewMode` | `'split' \| 'inline'` | `'split'` | Initial view mode |
| `showLineNumbers` | `boolean` | `true` | Show line numbers in code view |

## Styling

The component uses CSS variables for theming and inherits colors. Wire it into your design system:

```css
.mcr-root {
	--mcr-text: #your-text-color;
	--mcr-bg: #your-bg-color;
	--mcr-border-color: #your-border-color;
	--mcr-current-bg: rgba(64, 200, 174, 0.15);
	--mcr-incoming-bg: rgba(86, 156, 214, 0.15);
	/* ... more variables available in mergeConflictResolver.css */
}
```

## Architecture

- **MergeConflictResolver.ts** - Main React component
- **mergeConflictParser.ts** - Parses conflict markers into structured data
- **mergeConflictEdits.ts** - Applies conflict resolutions to text
- **mergeConflictTypes.ts** - TypeScript type definitions
- **diffUtils.ts** - Word/character-level diff computation for highlighting
- **mergeConflictResolver.css** - Styling with VS Code-inspired design

## Notes

- The component is controlled: you own the `value` state
- No external dependencies beyond React
- Fully typed with TypeScript
- Accessible keyboard navigation
