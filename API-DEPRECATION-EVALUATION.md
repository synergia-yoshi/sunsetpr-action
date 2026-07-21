# API deprecation evaluation

OpenAI's official deprecations page lists the Assistants API for shutdown on
2026-08-26 with the Responses API and Conversations API as its migration path. It lists the Videos
API for shutdown on 2026-09-24 without an official replacement.

SunsetPR keeps both entries in the machine-readable lifecycle database. It reports matching call
sites but does not rewrite either API surface as a model-ID substitution.

The reproducible Assistants engineering sample contains four licensed public repositories at fixed
commits, eight files, and 56 call sites. All 56 are currently detected.

```bash
npm run evaluate:api-deprecations
```

The manifest pins repository, full commit SHA, path, license URL, and expected count in
[`validation/api-deprecation-sample.json`](validation/api-deprecation-sample.json). The evaluator
downloads only those fixed public files into memory, follows only HTTPS responses that end at
`raw.githubusercontent.com`, and enforces a 1 MiB limit.

This is a curated positive regression sample. It is not a market-prevalence estimate or a claim
about recall and false-positive rates on arbitrary repositories.
