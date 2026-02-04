# GitLoom - Frequently Asked Questions

## General Questions

### What is GitLoom?

GitLoom is a desktop Git client that helps you manage multiple Git repositories with an intuitive visual interface. It's built with Electron, React, and TypeScript.

### Is GitLoom free?

Yes! GitLoom is completely free and open-source under the MIT License.

### Which operating systems are supported?

GitLoom supports Windows, macOS, and Linux.

### Do I need Git installed?

Yes, GitLoom requires Git to be installed on your system. You can download Git from [git-scm.com](https://git-scm.com/).

## Installation & Setup

### How do I install GitLoom?

Download the installer for your platform from the [Releases page](https://github.com/yourusername/gitloom/releases) and run it.

### How do I update GitLoom?

Currently, you need to download and install the new version manually. Auto-update functionality is planned for v1.0.0.

### Where does GitLoom store its settings?

GitLoom stores settings in your local browser storage within the Electron app. Your Git credentials are managed by your system's Git credential helper.

### Can I use GitLoom with multiple Git accounts?

Yes, GitLoom uses your system's Git configuration and credentials. Configure your Git accounts normally, and GitLoom will use them.

## Features

### Can I create new branches in GitLoom?

Branch creation UI is not yet implemented in v0.1.0 but is planned for v0.2.0. Currently, you can checkout and merge existing branches.

### Does GitLoom support stashing?

Stash management is planned for v0.2.0 and is not yet available in v0.1.0.

### Can I resolve merge conflicts in GitLoom?

A visual conflict resolution interface is planned for v0.2.0. Currently, you need to resolve conflicts externally and then refresh the view.

### Does GitLoom support Git tags?

Tag management is planned for v0.2.0.

### Can I rebase in GitLoom?

Interactive rebase support is planned for v0.3.0.

### Does GitLoom support submodules?

Submodule support is planned for v0.3.0.

## Usage

### How do I open a repository?

Click the folder icon in the top toolbar, select a parent folder containing Git repositories, and GitLoom will scan and load all repositories found.

### How do I stage files?

1. Select a repository
2. Click the "Changes" view icon (±)
3. Click the "+" button next to individual files or use "Stage All"

### How do I commit changes?

1. Stage your files
2. Enter a commit message in the text area
3. Click "Commit"

### How do I switch branches?

1. Click the "Branches" view icon (branch icon)
2. Right-click on the branch you want to switch to
3. Select "Checkout"

### How do I view file history?

In v0.1.0, you can view commit history. File-specific history viewing is planned for v0.4.0.

### Can I compare two commits?

Currently, you can view individual commit changes. Side-by-side commit comparison is planned for v0.2.0.

## Troubleshooting

### GitLoom won't start

1. Ensure you're running a supported OS version
2. Try running as administrator (Windows) or with sudo (Linux/Mac)
3. Check the console logs for errors

### Repositories aren't showing up

1. Verify the folders you selected contain valid Git repositories (have a .git folder)
2. Ensure you have read permissions for the repositories
3. Try refreshing the view

### Git operations are failing

1. Verify Git is installed: open a terminal and run `git --version`
2. Check that you have the necessary permissions (SSH keys, access tokens)
3. Ensure your Git credentials are configured correctly
4. Try the same operation in a terminal to see if it's a Git configuration issue

### The app is slow with large repositories

Performance optimizations for large repositories are planned for v0.2.0. Current version may struggle with repositories having >10,000 commits.

### I can't see remote branches

Ensure you've fetched from the remote at least once. Remote branches should appear in the branch tree with a "remotes/" prefix.

## Contributing

### How can I contribute to GitLoom?

See our [Contributing Guide](CONTRIBUTING.md) for detailed information on how to contribute code, report bugs, or suggest features.

### I found a bug. Where do I report it?

Please [create an issue](https://github.com/yourusername/gitloom/issues/new?template=bug_report.md) using our bug report template.

### I have a feature idea. How do I suggest it?

[Submit a feature request](https://github.com/yourusername/gitloom/issues/new?template=feature_request.md) using our feature request template.

### Can I translate GitLoom to my language?

Internationalization support is planned for v1.0.0. Once available, we'll welcome translation contributions!

## Technical Questions

### What technology is GitLoom built with?

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 28
- **UI**: Ant Design 5
- **Git**: simple-git library
- **Build**: Webpack 5

### Is my data secure?

GitLoom runs entirely on your local machine. It doesn't send any data to external servers. Your Git credentials are managed by your system's Git credential helper, not stored by GitLoom.

### Can I use GitLoom offline?

Yes! GitLoom works completely offline. You only need an internet connection for Git operations that require remote access (push, pull, fetch).

### Does GitLoom work with private repositories?

Yes, GitLoom works with any repository that your system's Git can access, including private repositories.

### Which Git hosting services are supported?

GitLoom works with any Git hosting service (GitHub, GitLab, Bitbucket, Azure DevOps, self-hosted, etc.) since it uses standard Git protocols.

## License & Legal

### What license is GitLoom under?

GitLoom is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Can I use GitLoom commercially?

Yes! The MIT License allows commercial use.

### Can I modify GitLoom?

Yes! You can fork, modify, and distribute GitLoom according to the MIT License terms.

## Still Have Questions?

- 💬 [Ask in GitHub Discussions](https://github.com/yourusername/gitloom/discussions)
- 📧 Contact us at [INSERT CONTACT EMAIL]
- 📚 Check the [Documentation](README.md)

---

**Last Updated:** February 2, 2026
