# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **[INSERT SECURITY EMAIL]**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information (as much as you can provide) to help us better understand the nature and scope of the possible issue:

* Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
* Full paths of source file(s) related to the manifestation of the issue
* The location of the affected source code (tag/branch/commit or direct URL)
* Any special configuration required to reproduce the issue
* Step-by-step instructions to reproduce the issue
* Proof-of-concept or exploit code (if possible)
* Impact of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

## Preferred Languages

We prefer all communications to be in English.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or email us.

## Security Best Practices for Users

When using GitLoom:

1. **Keep GitLoom updated** to the latest version to receive security patches
2. **Use SSH keys** for Git authentication instead of passwords when possible
3. **Enable 2FA** on your Git hosting service accounts
4. **Be cautious** with credentials - GitLoom never stores passwords directly
5. **Review permissions** when granting access to repositories
6. **Use trusted repositories** only, as malicious Git hooks can execute code

## Known Security Considerations

- GitLoom executes Git commands on your behalf, which can run Git hooks in repositories
- Always review repositories from untrusted sources before opening them
- The application has access to your Git credentials via the system's credential helper

## Security Updates

Security updates will be:
- Released as soon as possible after a vulnerability is confirmed
- Clearly marked in the CHANGELOG.md
- Announced in GitHub Security Advisories
- Communicated to users through the application's update notification system

Thank you for helping keep GitLoom and its users safe!
