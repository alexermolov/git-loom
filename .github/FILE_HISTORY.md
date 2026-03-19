# File History & Time Machine

This guide explains how to use the file history tools in GitLoom.

## What It Does

File History lets you inspect the lifecycle of one file across commits, including renames.

You can:

- open a timeline of changes for a file
- inspect older versions of the file
- compare the file between two commits
- restore the file content from a selected commit
- view file-level statistics

## How To Open File History

1. Open a repository in GitLoom.
2. Open a file in the file editor.
3. Click `File History` in the editor header.

GitLoom opens the File History panel for the current file.

## Timeline View

The default view is the timeline.

It shows:

- the list of commits that changed the file
- rename events, if the file changed path
- per-commit additions and deletions
- author and commit message for each change

From each timeline item you can:

- click `View` to open that version of the file
- click `Restore` to put that version back into your working tree
- click `View Commit` to jump to the related commit details

## Compare Two Versions

1. Open File History.
2. Click `Compare Versions`.
3. Select the `From Commit` and `To Commit`.
4. Confirm the dialog.

GitLoom shows:

- the two selected commits
- changed line counts
- a diff for the file between those two points in history

This works across renames when Git can follow the file history.

## View An Older Version

1. Open File History.
2. In the timeline, click `View` on a commit.

GitLoom opens a modal with:

- commit hash
- author
- date
- commit message
- file contents from that commit

## Restore A File From History

1. Open File History.
2. Click `Restore` on the commit you want.
3. Confirm the warning dialog.

Important behavior:

- restore writes the selected version into your working tree
- it does not automatically create a new commit
- it can overwrite local uncommitted changes for that file

Recommended workflow before restore:

1. commit your work, or
2. stash your changes

After restore, review the file diff and create a commit if the result is correct.

## File Statistics

1. Open File History.
2. Click `View Statistics`.

The statistics view shows:

- total commits touching the file
- total authors
- total additions and deletions
- file age
- author contribution breakdown
- activity by month

## Relationship To Blame

`Blame` and `File History` solve different problems.

- `Blame` answers: who last changed this line?
- `File History` answers: how did this file evolve over time?

Typical workflow:

1. open a file in the editor
2. use `Blame` to inspect the current lines
3. use `File History` to understand the broader timeline

## Known Limitations

- Line history depends on Git support for the current file path and works best when the file exists in the current checkout.
- Very large or binary files may have limited diffs or statistics.
- Restore only updates the file in the working tree. It does not restore surrounding project state from that commit.

## Recommended Use Cases

- find when a file changed behavior
- inspect a file before and after a refactor or rename
- recover a known-good version of one file without resetting the whole repository
- identify the main authors of a file before changing it