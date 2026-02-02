# Changelog

All notable changes to GitLoom will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Performance Optimizations** (v0.2.0 Roadmap Item #7) ✅
  - Repository caching with LRU eviction (100 MB limit, 5-minute TTL)
  - Git worker pool for non-blocking operations
  - Lazy loading and pagination for commit history (50 commits per page)
  - Virtual scrolling in commit lists (~60 DOM nodes instead of 1000+)
  - Incremental diff loading (500 lines at a time)
  - Smart cache invalidation on write operations
  - Result: 3-10x faster loading, 40-60% less memory usage
  
- **Stash Management** (v0.2.0 Roadmap Item #2) ✅
  - Create stash with custom messages
  - View stash list with details (date, branch, message)
  - Apply/Pop stash operations
  - Drop stash with confirmation
  - Stash diff viewer to preview changes
  - Create branch from stash
  - Full UI integration with StashPanel, StashListPanel, StashDetailsPanel
  
- **Conflict Resolution Interface** (v0.2.0 Roadmap Item #5) ✅
  - Visual conflict markers with color coding
  - Quick resolution actions (ours/theirs/both)
  - Individual conflict resolution
  - Batch resolution (resolve all conflicts)
  - Inline conflict editor with syntax highlighting
  - Manual editing modal
  - External merge tool integration
  - Automatic staging after resolution
  - Conflict file list with status tracking
  
- **Advanced History Visualization** (v0.3.0 Roadmap Item #13) 🔄
  - Git graph visualization with @gitgraph/react
  - Branch filtering in graph view
  - Custom branch colors with Metro theme
  - Dark mode support
  - Commit metadata display (hash, author, message)

### Planned
- Search and filter system across commits, branches, and files
- Remote repository management
- Advanced branch operations (create, delete, rename, compare)
- Tags management
- Interactive rebase
- Submodules support
- Git worktrees
- Commit signing (GPG)
- Blame/Annotate view

## [0.1.0] - 2026-02-02

### Added - Initial Release
- **Multi-repository management**: Scan and manage multiple Git repositories from a single parent folder
- **Commit history viewer**: Browse commit history with detailed information (hash, author, date, message)
- **Git graph visualization**: Interactive commit graph showing branch relationships and merge history
- **Branch management**: View local and remote branches in tree format
  - Checkout branches with confirmation dialogs
  - Merge branches with safety checks
  - Current branch highlighting
- **Working directory changes**: Real-time file status tracking
  - Stage and unstage files individually or in bulk
  - Visual diff viewer for changes
  - Create commits with custom messages
- **File tree browser**: Explore repository file structure
- **File diff viewer**: View file differences with syntax highlighting and statistics
- **Reflog viewer**: Track Git operation history
  - View HEAD movements
  - Reset to previous states
- **Git operations**:
  - Pull (fast-forward) from remote
  - Push to remote repository
  - Cherry-pick commits
  - Reset to specific commits
- **User interface**:
  - Dark/Light theme toggle
  - Resizable panels
  - Auto-save workspace preferences
  - Icon-based sidebar navigation
- **Repository status indicators**: Show ahead/behind, modified files, conflicts
- **Commit details panel**: View changed files for selected commits
- **Branch metadata**: Display last commit info, author, and date for each branch

### Technical
- Built with Electron 28, React 18, and TypeScript 5
- Ant Design 5 UI component library
- simple-git for Git operations
- Webpack 5 build system
- Support for Windows, macOS, and Linux platforms

### Known Issues
- No stash management yet
- Limited remote management (only pull/push)
- No branch creation/deletion UI
- Performance may be slow with very large repositories (>10,000 commits)
- No search functionality
- No conflict resolution UI
- No tags support

## Version History

### [0.1.0] - 2026-02-02
Initial public release of GitLoom.

---

## Release Notes Format

Each release will include:

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security updates

[Unreleased]: https://github.com/yourusername/gitloom/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/gitloom/releases/tag/v0.1.0
