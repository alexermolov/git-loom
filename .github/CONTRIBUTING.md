# Contributing to GitLoom

First off, thank you for considering contributing to GitLoom! 🎉

GitLoom is an open-source project, and we love to receive contributions from our community. There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests, or writing code which can be incorporated into GitLoom itself.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [TypeScript Style Guide](#typescript-style-guide)
  - [React Component Guidelines](#react-component-guidelines)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by the [GitLoom Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, screenshots, etc.)
- **Describe the behavior you observed and what you expected**
- **Include details about your environment** (OS, GitLoom version, Node.js version)
- **If applicable, include error messages and stack traces**

Use the bug report template when creating a new issue.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful** to most GitLoom users
- **List any alternative solutions or features you've considered**
- **Include mockups or examples if applicable**

Use the feature request template when creating a new issue.

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

- **good first issue** - Issues that should only require a few lines of code
- **help wanted** - Issues that may be more involved but are great for contributors

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the development setup** instructions below
3. **Make your changes** following our style guidelines
4. **Test your changes** thoroughly
5. **Update documentation** if you changed functionality
6. **Write a clear commit message** following our guidelines
7. **Push to your fork** and submit a pull request

**Pull Request Guidelines:**

- Fill out the pull request template completely
- Link any related issues in the PR description
- Include screenshots or GIFs for UI changes
- Ensure all tests pass and there are no linting errors
- Keep PRs focused - one feature/fix per PR
- Update the CHANGELOG.md with your changes

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git

### Setup Instructions

```bash
# 1. Fork and clone the repository
git clone https://github.com/your-username/gitloom.git
cd gitloom

# 2. Install dependencies
npm install

# 3. Start development mode
npm run dev

# This will start both the main and renderer processes
# The app will reload automatically when you make changes
```

### Building

```bash
# Build for production
npm run build

# Package for your platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Style Guidelines

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line
- Consider using [Conventional Commits](https://www.conventionalcommits.org/)

**Examples:**

```
feat: Add branch comparison feature
fix: Resolve commit graph rendering issue
docs: Update installation instructions
style: Format code according to style guide
refactor: Simplify git service error handling
test: Add tests for file diff component
chore: Update dependencies
```

### TypeScript Style Guide

- Use TypeScript for all new code
- Define explicit types for function parameters and return values
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes
- Use enums for related constants
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use async/await over raw promises

**Example:**

```typescript
interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export async function getCommits(repoPath: string, maxCount: number = 100): Promise<CommitInfo[]> {
  // Implementation
}
```

### React Component Guidelines

- Use functional components with hooks
- Keep components small and focused (< 300 lines)
- Extract reusable logic into custom hooks
- Use meaningful prop names and add TypeScript types
- Keep state as local as possible
- Use proper keys in lists
- Handle loading and error states

**Example:**

```typescript
interface CommitsPanelProps {
  commits: CommitInfo[];
  onCommitClick?: (commit: CommitInfo) => void;
}

const CommitsPanel: React.FC<CommitsPanelProps> = ({ commits, onCommitClick }) => {
  // Component implementation
};

export default CommitsPanel;
```

### Code Organization

- Group related functions and types together
- Export only what's necessary
- Use barrel exports (index.ts) for cleaner imports
- Keep files focused on a single responsibility
- Use meaningful file and directory names

## Project Structure

```
gitloom/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # App entry, window management, IPC handlers
│   │   ├── gitService.ts  # All Git operations
│   │   └── preload.ts     # Secure IPC bridge
│   └── renderer/          # React renderer process
│       ├── App.tsx        # Main app component
│       ├── components/    # Reusable React components
│       ├── types.ts       # Shared TypeScript types
│       ├── styles.css     # Global styles
│       └── index.tsx      # React entry point
├── release/               # Built distributions
├── webpack.*.config.js    # Webpack configs
├── tsconfig.json          # TypeScript config
└── package.json           # Dependencies and scripts
```

### Adding New Features

1. **Main Process Changes** - Add to `gitService.ts` and expose via IPC in `main.ts`
2. **Renderer Changes** - Create components in `src/renderer/components/`
3. **Types** - Add to `src/renderer/types.ts` or create new type files
4. **Styles** - Add to `styles.css` or use inline styles for component-specific styling

## Testing

Currently, GitLoom doesn't have automated tests (help wanted!). Before submitting a PR:

1. Test your changes manually on your platform
2. Test common workflows end-to-end
3. Verify no console errors occur
4. Check that existing features still work
5. Test edge cases (empty repos, large repos, network errors)

**Future Testing Strategy:**

- Unit tests for `gitService.ts` functions
- Integration tests for IPC communication
- E2E tests for critical user workflows
- Visual regression tests for UI components

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments for public functions and complex logic
- Update ROADMAP.md if implementing planned features
- Create/update wiki pages for major features
- Include code comments for non-obvious implementations

**Documentation Standards:**

```typescript
/**
 * Retrieves commit history for a repository
 * @param repoPath - Absolute path to the Git repository
 * @param maxCount - Maximum number of commits to retrieve (default: 100)
 * @returns Array of commit information objects
 * @throws Error if repository is invalid or Git command fails
 */
export async function getCommits(repoPath: string, maxCount: number = 100): Promise<CommitInfo[]> {
  // Implementation
}
```

## Questions?

Don't hesitate to ask questions! You can:

- Open a [GitHub Discussion](https://github.com/yourusername/gitloom/discussions)
- Comment on an existing issue
- Reach out to the maintainers

## Recognition

Contributors will be recognized in:

- The project README
- Release notes for the version their contribution ships in
- Our contributors page

Thank you for contributing to GitLoom! 🚀
