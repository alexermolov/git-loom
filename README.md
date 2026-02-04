# GitLoom

<div align="center">

<img src="build/logo.png" alt="GitLoom" width="140" />

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

Desktop Git client built with Electron + React + TypeScript.

[Features](#features) • [Install](#install) • [Run](#run) • [Development](#development) • [Docs](#docs) • [Contributing](#contributing)

</div>

## Overview

GitLoom is a cross-platform desktop Git client focused on working with many repositories at once: browse history, branches, diffs, stashes/tags/remotes, and perform common Git operations from a single UI.

GitLoom runs locally and uses your system Git installation (via `simple-git`).

## Features

- Multi-repository workspace: scan a parent folder, switch repos quickly, see status (ahead/behind, dirty/clean, conflicts)
- History exploration: commits list, commit details, file changes, interactive graph view
- Working directory workflow: stage/unstage, commit, view diffs (staged/unstaged)
- Branches: tree view, checkout/merge and other common branch operations
- Search: find commits/refs and filter long lists
- Stash, tags, remotes: manage stashes/tags/remotes from the UI
- Reflog: inspect HEAD movements and recover from mistakes
- Performance: caching + worker-based Git operations for smoother UI on large repos

## Install

### Pre-built releases

If you got an installer from the GitHub Releases page, run it and launch GitLoom.

### Build from source

Prerequisites:

- Node.js 18+
- Git installed and available on PATH

Install dependencies:

```bash
npm install
```

## Run

### Development (hot reload)

This launches both Webpack dev server (renderer) and Electron:

```bash
npm run dev:launch
```

Notes:

- `npm run dev` only starts the main/renderer build watchers.
- `npm run dev:electron` assumes the renderer is available on http://localhost:3000 and `dist/main` is being rebuilt.

### Production-like run (from built files)

```bash
npm run build
npm start
```

On Windows you can also use [run.bat](run.bat).

## Build & package

Build only:

```bash
npm run build
```

Create an installer/package via electron-builder:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

Artifacts are written to the `release/` directory (see the `build.directories.output` setting in `package.json`).

## Docs

Start here, then jump to the deeper docs:

- [Architecture](ARCHITECTURE.md)
- [Changelog](CHANGELOG.md)
- [FAQ](FAQ.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)
- [License](LICENSE)

## Contributing

PRs and issue reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Security

For vulnerability reporting, follow [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).

## 💬 Community & Support

- **Documentation**: [Wiki](https://github.com/yourusername/gitloom/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/gitloom/discussions)
- **Issues**: [Bug Tracker](https://github.com/yourusername/gitloom/issues)

---

<div align="center">

**Made with ❤️ by the GitLoom Team**

⭐ Star us on GitHub if you find this useful!

</div>
