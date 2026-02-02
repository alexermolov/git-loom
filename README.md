# 🧶 GitLoom

<div align="center">

![GitLoom Logo](https://img.shields.io/badge/GitLoom-v0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

**A powerful, intuitive desktop application for weaving through Git history and managing multiple repositories**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Development](#-development) • [Roadmap](#-roadmap) • [Contributing](#-contributing)

</div>

---

## 📖 Overview

GitLoom is a modern, cross-platform desktop Git client built with Electron, React, and TypeScript. It provides an elegant visual interface for managing multiple Git repositories, viewing commit history, handling branches, staging changes, and performing common Git operations—all without leaving your desktop.

Perfect for developers who work with multiple repositories and want a unified, visual way to track changes, understand history, and manage their Git workflow.

## ✨ Features

### 🎯 Core Features

- **🗂️ Multi-Repository Management**
  - Scan and load multiple Git repositories from a single parent folder
  - Quick-switch between repositories with auto-saved state
  - Visual repository status indicators (ahead/behind, modified files, conflicts)
  - Real-time repository information display

- **📜 Advanced Commit Visualization**
  - View commit history with detailed information (hash, author, date, message)
  - Interactive commit graph showing branch relationships and merge history
  - Commit details with file changes and statistics
  - One-click commit hash copying
  - Support for filtering by branch

- **🌳 Branch Management**
  - Visual branch tree with local and remote branches
  - Quick branch checkout with confirmation dialogs
  - Branch merging with safety checks
  - Current branch highlighting
  - Branch metadata (last commit, author, date)

- **📝 Working Directory Changes**
  - Real-time file status tracking (modified, added, deleted, renamed)
  - Stage/unstage individual or multiple files
  - Visual diff viewer for staged and unstaged changes
  - Commit creation with message editor
  - Support for staged and working directory diffs

- **🔍 File Exploration**
  - Repository file tree browser
  - File content viewer for any commit
  - Syntax-highlighted diff viewer
  - Addition/deletion statistics
  - Compare files across commits

- **📊 Git Operations**
  - Pull (fast-forward) from remote
  - Push to remote repository
  - Cherry-pick commits between branches
  - Reset to specific commits
  - Reflog viewer for operation history

- **🎨 User Experience**
  - Dark/Light theme toggle
  - Responsive, resizable panels
  - Auto-save of workspace state and preferences
  - Loading indicators for async operations
  - Informative error messages and confirmations

### 🔄 Reflog Support

Track all Git operations with integrated reflog viewing:
- View complete history of HEAD movements
- Track branch switches, commits, resets, and merges
- Easily recover from mistakes by resetting to previous states

## 🚀 Installation

### Pre-built Releases

Download the latest release for your platform:

- **Windows**: `GitLoom-Setup-{version}.exe`
- **macOS**: `GitLoom-{version}.dmg`
- **Linux**: `GitLoom-{version}.AppImage`

### Build from Source

#### Prerequisites

- Node.js 18+ and npm
- Git

#### Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/gitloom.git
cd gitloom

# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 💻 Usage

### Getting Started

1. **Launch GitLoom** - Open the application
2. **Select Parent Folder** - Click the folder icon and choose a directory containing Git repositories
3. **Browse Repositories** - GitLoom will scan and load all repositories found
4. **Select Repository** - Click on any repository in the sidebar to view its details

### Key Operations

#### Viewing Commits
- Select a repository from the left sidebar
- Click on the "Commits" view icon
- Browse the commit history in the middle panel
- Click on a commit to view changed files and diffs

#### Managing Branches
- Click the "Branches" view icon
- Right-click on any branch for options:
  - **Checkout**: Switch to the branch
  - **Merge**: Merge into current branch
- Current branch is highlighted in blue

#### Staging and Committing Changes
- Click the "Changes" view icon
- Review modified, added, or deleted files
- Click `+` to stage individual files or use "Stage All"
- Enter a commit message in the text area
- Click "Commit" to create the commit

#### Viewing Diffs
- Select a file from the file list
- View the diff in the right panel
- Green lines = additions, Red lines = deletions

#### Using Git Graph
- Click "Git Graph" tab in the main panel
- Visualize branch structure and merge history
- Understand complex branching strategies

#### Reflog Operations
- Click the "Reflog" view icon
- Browse the complete history of operations
- Right-click on any entry to reset to that state

### Keyboard Shortcuts

- `Ctrl/Cmd + O` - Open folder dialog
- `Ctrl/Cmd + R` - Refresh current repository
- `Ctrl/Cmd + T` - Toggle theme

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Desktop Framework**: Electron 28
- **UI Library**: Ant Design 5
- **Git Integration**: simple-git
- **Build Tool**: Webpack 5
- **Graph Visualization**: @gitgraph/react

## 🏗️ Development

### Project Structure

```
gitloom/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Application entry point
│   │   ├── gitService.ts  # Git operations service
│   │   └── preload.ts     # Preload script for IPC
│   └── renderer/          # React application
│       ├── App.tsx        # Main application component
│       ├── components/    # React components
│       └── types.ts       # TypeScript type definitions
├── release/               # Built application packages
├── webpack.*.config.js    # Webpack configurations
└── package.json           # Project metadata
```

### Scripts

```bash
npm run dev              # Start development mode with hot reload
npm run build            # Build for production
npm start                # Start built application
npm run package          # Create distributable package
```

### Architecture

GitLoom follows a clean architecture:

1. **Main Process** (`src/main/`)
   - Handles system-level operations
   - Manages windows and lifecycle
   - Provides IPC handlers for Git operations

2. **Renderer Process** (`src/renderer/`)
   - React-based UI
   - Component-driven architecture
   - State management with hooks

3. **Git Service** (`gitService.ts`)
   - Abstraction layer over simple-git
   - Provides typed interfaces for all Git operations
   - Error handling and validation

## 📋 Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and development priorities.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [Ant Design](https://ant.design/)
- Git integration via [simple-git](https://github.com/steveukx/git-js)
- Graph visualization by [@gitgraph/react](https://gitgraphjs.com/)

## 🐛 Bug Reports & Feature Requests

Please use the [GitHub Issues](https://github.com/yourusername/gitloom/issues) page to report bugs or request features.

## 💬 Community & Support

- **Documentation**: [Wiki](https://github.com/yourusername/gitloom/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/gitloom/discussions)
- **Issues**: [Bug Tracker](https://github.com/yourusername/gitloom/issues)

---

<div align="center">

**Made with ❤️ by the GitLoom Team**

⭐ Star us on GitHub if you find this useful!

</div>
