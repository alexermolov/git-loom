# GitLoom Architecture

## Overview

GitLoom is an Electron-based desktop application that provides a rich graphical interface for Git repository management. The application follows a standard Electron architecture with clear separation between the main process (Node.js) and renderer process (React).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        GitLoom App                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐           ┌───────────────────────┐  │
│  │  Main Process    │◄─────────►│  Renderer Process     │  │
│  │  (Node.js)       │    IPC    │  (React)              │  │
│  └──────────────────┘           └───────────────────────┘  │
│         │                                   │                │
│         │                                   │                │
│         ▼                                   ▼                │
│  ┌──────────────────┐           ┌───────────────────────┐  │
│  │   Git Service    │           │   React Components    │  │
│  │  (simple-git)    │           │   - Sidebar           │  │
│  │                  │           │   - CommitsPanel      │  │
│  │  - scanRepos     │           │   - BranchTree        │  │
│  │  - getCommits    │           │   - ChangesPanel      │  │
│  │  - getBranches   │           │   - DiffViewer        │  │
│  │  - stageFiles    │           │   - GitGraph          │  │
│  │  - pushPull      │           └───────────────────────┘  │
│  │  - etc.          │                                        │
│  └──────────────────┘                                        │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────────┐                                        │
│  │  Git Repositories│                                        │
│  │  (File System)   │                                        │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Main Process (`src/main/`)

The main process is responsible for:
- **Window Management**: Creating and managing the application window
- **IPC Handlers**: Setting up communication between main and renderer processes
- **Git Operations**: Executing Git commands via the Git Service
- **File System Access**: Opening folders and accessing repositories

**Key Files:**
- `main.ts` - Entry point, window creation, IPC handler registration
- `gitService.ts` - Abstraction layer over simple-git for all Git operations
- `preload.ts` - Secure bridge between main and renderer processes

### 2. Renderer Process (`src/renderer/`)

The renderer process is responsible for:
- **User Interface**: React components for all UI elements
- **State Management**: React hooks for application state
- **User Interactions**: Handling clicks, inputs, and navigation
- **Display Logic**: Formatting and presenting Git data

**Key Files:**
- `App.tsx` - Main application component, top-level state management
- `components/` - Reusable React components
  - `Sidebar.tsx` - Repository list
  - `IconSidebar.tsx` - View switcher
  - `CommitsPanel.tsx` - Commit history display
  - `BranchTreePanel.tsx` - Branch tree view
  - `ChangesPanel.tsx` - Working directory changes
  - `GitGraphView.tsx` - Visual commit graph
  - `FileDiffPanel.tsx` - File diff viewer
  - And more...

### 3. IPC Communication

Communication between main and renderer processes uses Electron's IPC (Inter-Process Communication):

```typescript
// Renderer → Main (invoke)
const repos = await window.electronAPI.scanRepositories(folderPath);

// Main → Renderer (handle)
ipcMain.handle('git:scanRepositories', async (event, folderPath) => {
  return await scanForRepositories(folderPath);
});
```

**Available IPC Channels:**
- `dialog:openFolder` - Open folder selection dialog
- `git:scanRepositories` - Scan for Git repositories
- `git:getRepositoryInfo` - Get repository status
- `git:getCommits` - Fetch commit history
- `git:getBranches` - Get branch list
- `git:pullRepository` - Pull from remote
- `git:pushRepository` - Push to remote
- `git:stageFiles` - Stage files for commit
- `git:createCommit` - Create a new commit
- And many more...

## Data Flow

### Example: Loading Repository Commits

```
1. User clicks on repository in Sidebar
   ↓
2. App.tsx calls setSelectedRepo(repoPath)
   ↓
3. useEffect triggered, calls window.electronAPI.getCommits(repoPath)
   ↓
4. IPC message sent to main process
   ↓
5. Main process calls getCommits() from gitService
   ↓
6. gitService uses simple-git to execute Git command
   ↓
7. Git command returns commit data
   ↓
8. Data returned through IPC to renderer
   ↓
9. App.tsx updates commits state
   ↓
10. CommitsPanel re-renders with new commit data
```

## State Management

GitLoom uses React hooks for state management:

```typescript
// Repository state
const [repositories, setRepositories] = useState<Map<string, RepositoryInfo>>();
const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

// View state
const [activeView, setActiveView] = useState<ViewType>('commits');
const [commits, setCommits] = useState<CommitInfo[]>([]);
const [branches, setBranches] = useState<BranchInfo[]>([]);

// UI state
const [isDarkTheme, setIsDarkTheme] = useState(false);
const [loading, setLoading] = useState(false);
```

State is stored at the top level in `App.tsx` and passed down to components via props.

## Technology Stack

### Core
- **Electron 28** - Desktop application framework
- **React 18** - UI library
- **TypeScript 5** - Type-safe JavaScript

### UI & Styling
- **Ant Design 5** - UI component library
- **CSS** - Custom styling
- **@ant-design/icons** - Icon library

### Git Integration
- **simple-git** - Node.js Git interface

### Build Tools
- **Webpack 5** - Module bundler
- **TypeScript Compiler** - TS to JS compilation
- **Electron Builder** - Application packaging

### Graph Visualization
- **@gitgraph/react** - Git graph visualization

## Security Model

GitLoom follows Electron security best practices:

1. **Context Isolation**: Renderer process is isolated from Node.js APIs
2. **Preload Script**: Controlled exposure of APIs via preload
3. **No Node Integration**: Renderer doesn't have direct Node.js access
4. **IPC Whitelist**: Only specific IPC channels are exposed
5. **No Remote Module**: Remote module is disabled

```typescript
// Secure preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  scanRepositories: (folderPath: string) => 
    ipcRenderer.invoke('git:scanRepositories', folderPath),
  // Only specific APIs exposed
});
```

## File Structure

```
gitloom/
├── src/
│   ├── main/              # Main process (Node.js)
│   │   ├── main.ts        # Entry point, window management
│   │   ├── gitService.ts  # Git operations abstraction
│   │   └── preload.ts     # IPC bridge
│   │
│   └── renderer/          # Renderer process (React)
│       ├── App.tsx        # Main app component
│       ├── index.tsx      # React entry point
│       ├── types.ts       # TypeScript interfaces
│       ├── styles.css     # Global styles
│       ├── index.html     # HTML template
│       └── components/    # React components
│
├── webpack.main.config.js    # Webpack config for main process
├── webpack.renderer.config.js # Webpack config for renderer
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Build Process

1. **Development**: 
   - `npm run dev` starts both main and renderer in watch mode
   - Renderer runs on webpack-dev-server (http://localhost:3000)
   - Main process watches for changes and recompiles

2. **Production Build**:
   - `npm run build` compiles both processes
   - Output goes to `dist/` folder
   - Webpack optimizes and minifies code

3. **Packaging**:
   - `npm run build:win/mac/linux` packages for each platform
   - Electron Builder creates installers
   - Output goes to `release/` folder

## Performance Considerations

1. **Lazy Loading**: Commits and file trees are loaded on-demand
2. **Memoization**: React components use memoization to avoid re-renders
3. **Debouncing**: User input is debounced to reduce API calls
4. **Virtual Scrolling**: (Planned) For large lists
5. **Caching**: (Planned) Repository data caching

## Extension Points

Future extensibility considerations:

1. **Plugin System**: Load custom plugins from user directory
2. **Custom Git Commands**: Register custom Git operations
3. **Theme System**: Custom theme support
4. **External Tools**: Integration with external diff/merge tools
5. **Webhook Support**: React to external events

## Testing Strategy (Planned)

1. **Unit Tests**: Test Git service functions
2. **Component Tests**: Test React components in isolation
3. **Integration Tests**: Test IPC communication
4. **E2E Tests**: Test complete user workflows
5. **Performance Tests**: Benchmark large repositories

## Contributing to Architecture

When adding new features:

1. **Git Operations**: Add to `gitService.ts`
2. **IPC Handlers**: Register in `main.ts`
3. **UI Components**: Create in `renderer/components/`
4. **Types**: Define in `renderer/types.ts`
5. **Documentation**: Update this file

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.
