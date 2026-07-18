# Security

## Supported versions

Security fixes are applied to the current `v0` release line.

## Report a vulnerability privately

Use this repository's **Security → Report a vulnerability** flow. Do not disclose a vulnerability, secret, private repository name, or customer code in a public issue.

Include the affected release, runner operating system, reproduction steps, and impact. Never include live credentials.

## Design boundaries

- read-only GitHub token permissions
- no outbound network requests from the Action
- no external AI model calls
- bounded file count, per-file size, and total bytes
- symlinks are ignored
- no automatic code changes, merge, or deployment
- dynamic values remain explicitly unconfirmed

Security policy does not create a paid support SLA.
