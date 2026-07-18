# Data handling

## Free GitHub Action

The free Action executes on the repository's GitHub Actions runner. SunsetPR does not operate an API endpoint in this path.

It reads supported source and configuration files to locate exact known model IDs, selected
deprecated API call shapes, and unresolved model expressions. It writes a JSON report, GitHub
workflow annotations, and a Job Summary inside the same workflow run. It does not send repository
content, findings, secrets, or environment-variable values to SunsetPR or to an external AI model.

GitHub processes workflow source, logs, summaries, and artifacts under the repository owner's GitHub agreement and settings. Repository owners control workflow and artifact retention.

## Public issues

Issue content in this repository is public. Do not paste proprietary code, credentials, environment values, customer data, or security vulnerabilities into an issue. Use GitHub private vulnerability reporting for security reports.

## Repair beta

The repair GitHub App is a separate, invitation-only beta. Installing it requires explicit repository selection and write permission for draft branches and pull requests. Its current deterministic repair path does not send customer code to an external model. A production privacy policy and terms require human legal approval before paid general availability.
