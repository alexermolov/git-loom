# Git Reflog Feature Documentation

## Overview
Added a comprehensive Git Reflog viewer to GitLoom. The reflog (reference log) shows the history of HEAD and branch references, allowing you to track all changes and recover from mistakes.

## Features

### 1. **Reflog Viewer Interface**
- **Location**: Click the clock icon (🕒) in the left sidebar to access the Reflog view
- **Display**: Shows reflog entries in a tree structure with detailed information
- **Auto-refresh**: Automatically loads the last 100 reflog entries

### 2. **Information Display**
Each reflog entry shows:
- **Action Icon & Tag**: Visual indicator of the action type (commit, checkout, merge, reset, etc.)
- **Commit Hash**: Short hash (7 characters) of the commit
- **Selector**: Reflog selector (e.g., HEAD@{0}, HEAD@{1})
- **Message**: Full action message
- **Author**: Person who performed the action
- **Timestamp**: Relative time ("2 hours ago") or absolute date/time

### 3. **Action Types with Color Coding**
- **Commit** (Green): New commits created
- **Checkout** (Blue): Branch switches
- **Merge** (Purple): Merge operations
- **Reset** (Orange): Reset operations
- **Rebase** (Magenta): Rebase operations
- **Pull** (Cyan): Pull operations
- **Other** (Gray): Other Git operations

### 4. **Reference Selection**
Choose which reference to view:
- **HEAD**: Shows history of current HEAD (default)
- **Upstream**: Shows upstream branch history
- **All Refs**: Shows history of all references

### 5. **Context Menu Actions**
Right-click or click the "..." menu on any entry to access:
- **View Commit Details**: Opens the commit files in the main panel
- **Reset (Soft)**: Move HEAD to this commit, keep changes staged
- **Reset (Mixed)**: Move HEAD to this commit, keep changes unstaged
- **Reset (Hard)**: Move HEAD to this commit, discard all changes (with confirmation)
- **Copy Commit Hash**: Copy the full commit hash to clipboard

### 6. **Reset Modes Explained**
- **Soft Reset**: Moves HEAD but keeps all changes in staging area
- **Mixed Reset**: Moves HEAD and unstages changes (but keeps them in working directory)
- **Hard Reset**: Moves HEAD and discards all uncommitted changes ⚠️ **DANGEROUS**

### 7. **Safety Features**
- **Confirmation Dialog**: Hard reset requires explicit confirmation
- **Mode Selection**: Choose reset mode in the confirmation dialog
- **Warning Messages**: Clear warnings about data loss for hard resets

## Usage Examples

### Viewing Recent Activity
1. Click the clock icon in the sidebar
2. Browse through the list of recent actions
3. Click on any entry to view its commit details

### Recovering from a Mistake
1. Find the commit before the mistake in the reflog
2. Click the "..." menu
3. Choose "Reset (Mixed)" to go back while keeping changes
4. Or choose "Reset (Hard)" to completely undo changes (with caution)

### Finding a Lost Commit
1. Switch to reflog view
2. Look for the commit you need (reflog shows even "deleted" commits)
3. View details or reset to that commit

### Tracking Branch Switches
1. Open reflog
2. Look for "CHECKOUT" actions (shown in blue)
3. See when and where you switched branches

## Technical Details

### Backend Implementation
- **Service**: `getReflog()` in `gitService.ts`
- **Command**: Uses `git reflog` with custom format
- **Parsing**: Extracts selector, hash, ref name, action, message, date, and author
- **IPC Handler**: `git:getReflog` channel in main process

### Frontend Components
- **Panel**: `ReflogPanel.tsx` - Main reflog viewer
- **Integration**: Connected through `MiddlePanel` and `App.tsx`
- **State Management**: React hooks for data fetching and UI state

### API Methods
```typescript
// Get reflog entries
getReflog(repoPath: string, ref?: string, maxCount?: number): Promise<ReflogEntry[]>

// Reset to a specific commit
resetToCommit(repoPath: string, commitHash: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void>
```

### Data Structure
```typescript
interface ReflogEntry {
  selector: string;        // e.g., "HEAD@{0}"
  hash: string;            // Full commit hash
  refName: string;         // Reference name (e.g., "HEAD")
  action: string;          // Action type (commit, checkout, etc.)
  message: string;         // Full action message
  date: string;            // ISO date string
  author: string;          // Person who performed the action
}
```

## Keyboard Shortcuts
- No specific keyboard shortcuts for reflog yet
- Use standard navigation (arrows, enter, etc.) in the tree view

## Tips & Best Practices

1. **Regular Checks**: Check reflog before performing destructive operations
2. **Recovery**: Use reflog to find and recover "lost" commits
3. **Debugging**: Track down when something went wrong by reviewing actions
4. **Caution with Hard Reset**: Always double-check before using hard reset
5. **Copy Hashes**: Use "Copy Commit Hash" to reference specific commits

## Limitations

- Shows last 100 entries by default (configurable)
- Reflog is local - not shared across clones
- Reflog entries expire after 90 days (Git default)
- Some operations may not create reflog entries

## Future Enhancements

Potential improvements:
- Filter by action type
- Search in reflog entries
- Custom date range selection
- Visual timeline view
- Compare reflog between branches
- Export reflog to file
- Cherry-pick from reflog entry
