# Contributing

Lifecycle-data changes must cite an official OpenAI, Anthropic, or Google Gemini documentation URL. Third-party feeds can identify a candidate change but cannot be the committed source of truth.

Scanner changes must include a positive or negative regression case. Do not weaken the rule that unresolved dynamic values require runtime confirmation.

Before opening a pull request, run:

```bash
npm ci
npm run typecheck
npm test
npm run package
```

Do not commit secrets, private repository data, provider console exports, or customer code.
