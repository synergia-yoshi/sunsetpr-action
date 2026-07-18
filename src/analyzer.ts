import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Lang, parse, registerDynamicLanguage, type SgNode } from "@ast-grep/napi";
import type {
  Finding,
  LifecycleEntry,
  Location,
  ModelFinding,
  Provider,
  RuntimeCheckFinding,
} from "./types.js";

function pythonParserPath(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const platformNames: Partial<Record<NodeJS.Platform, string>> = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows",
  };
  const architectureNames: Partial<Record<NodeJS.Architecture, string>> = {
    arm64: "ARM64",
    x64: "X64",
  };
  const platformName = platformNames[process.platform];
  const architectureName = architectureNames[process.arch];
  const candidates = [
    process.env.SUNSETPR_PYTHON_PARSER,
    path.join(moduleDirectory, "python-parser", "parser.so"),
    platformName && architectureName
      ? path.resolve(
          moduleDirectory,
          "../../node_modules/@ast-grep/lang-python/prebuilds",
          `prebuild-${platformName}-${architectureName}`,
          "parser.so",
        )
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const parserPath = candidates.find((candidate) => existsSync(candidate));
  if (!parserPath) {
    throw new Error(
      `No bundled Python parser is available for ${process.platform}-${process.arch}`,
    );
  }
  return parserPath;
}

registerDynamicLanguage({
  python: {
    libraryPath: pythonParserPath(),
    extensions: ["py"],
    languageSymbol: "tree_sitter_python",
    expandoChar: "µ",
  },
});

interface SdkCall {
  provider: Provider;
  name: string;
}

function walk(node: SgNode, callback: (node: SgNode) => void): void {
  callback(node);
  for (const child of node.children()) {
    walk(child, callback);
  }
}

function toLocation(
  relativePath: string,
  line: number,
  column: number,
  byteStart: number,
  byteEnd: number,
): Location {
  return { path: relativePath, line: line + 1, column: column + 1, byteStart, byteEnd };
}

function findingId(kind: string, location: Location, discriminator: string): string {
  return `${kind}:${location.path}:${location.line}:${location.column}:${discriminator}`;
}

function providerEvidence(content: string, provider: Provider): boolean {
  switch (provider) {
    case "openai":
      return /(?:from\s+["']openai["']|from\s+openai\b|require\(["']openai["']\)|\bOpenAI\b)/.test(
        content,
      );
    case "anthropic":
      return /(?:@anthropic-ai\/sdk|from\s+anthropic\b|import\s+anthropic\b|\bAnthropic\b)/.test(
        content,
      );
    case "gemini":
      return /(?:@google\/(?:generative-ai|genai)|google\.generativeai|\bGoogleGenerativeAI\b|\bGeminiClient\b|\bgenai\b)/.test(
        content,
      );
  }
}

function detectSdkCall(text: string, content: string): SdkCall | null {
  if (
    /\.(?:responses|chat\.completions)\.create\s*\(/.test(text) ||
    /\bChatCompletion\.create\s*\(/.test(text)
  ) {
    return { provider: "openai", name: "OpenAI create" };
  }
  if (/\.messages\.create\s*\(/.test(text) && providerEvidence(content, "anthropic")) {
    return { provider: "anthropic", name: "Anthropic Messages" };
  }
  if (
    /\.(?:models\.)?(?:generateContent|generate_content)\s*\(/.test(text) ||
    /\.getGenerativeModel\s*\(/.test(text)
  ) {
    if (providerEvidence(content, "gemini")) {
      return { provider: "gemini", name: "Gemini generate content" };
    }
  }
  return null;
}

function modelArgument(call: SgNode): SgNode | null {
  let result: SgNode | null = null;
  walk(call, (node) => {
    if (result) {
      return;
    }
    const text = node.text();
    if (node.kind() === "pair" && /^\s*(?:model|modelId|model_id)\s*:/.test(text)) {
      result = node;
    } else if (node.kind() === "keyword_argument" && /^\s*(?:model|model_id)\s*=/.test(text)) {
      result = node;
    }
  });
  return result;
}

function stringValue(node: SgNode): string | null {
  if (node.kind() !== "string" && node.kind() !== "template_string") {
    return null;
  }
  const text = node.text();
  const match = text.match(/^(?:[rubfRUBF]*)(["'`])([\s\S]*)\1$/);
  return match?.[2] ?? null;
}

function hasLiteralModelInNode(node: SgNode): boolean {
  let found = false;
  walk(node, (descendant) => {
    const value = stringValue(descendant);
    if (value !== null) {
      found = true;
    }
  });
  return found;
}

function modelContext(
  node: SgNode,
  content: string,
  provider: Provider,
): {
  sourceKind: "hardcoded" | "environment";
  confidence: "high" | "medium";
  sdk: string | null;
} | null {
  for (const ancestor of node.ancestors()) {
    const text = ancestor.text();
    if (ancestor.kind() === "pair" && /^\s*(?:model|modelId|model_id)\s*:/.test(text)) {
      const call = ancestor
        .ancestors()
        .find((candidate) => ["call", "call_expression"].includes(String(candidate.kind())));
      const sdk = call ? detectSdkCall(call.text(), content) : null;
      return {
        sourceKind: /(?:process\.env|Deno\.env|import\.meta\.env)/.test(text)
          ? "environment"
          : "hardcoded",
        confidence: sdk?.provider === provider ? "high" : "medium",
        sdk: sdk?.provider === provider ? sdk.name : null,
      };
    }
    if (ancestor.kind() === "keyword_argument" && /^\s*(?:model|model_id)\s*=/.test(text)) {
      const call = ancestor
        .ancestors()
        .find((candidate) => ["call", "call_expression"].includes(String(candidate.kind())));
      const sdk = call ? detectSdkCall(call.text(), content) : null;
      return {
        sourceKind: /(?:os\.(?:environ|getenv)|environ\.get)/.test(text)
          ? "environment"
          : "hardcoded",
        confidence: sdk?.provider === provider ? "high" : "medium",
        sdk: sdk?.provider === provider ? sdk.name : null,
      };
    }
    if (
      ["variable_declarator", "assignment", "expression_statement"].includes(
        String(ancestor.kind()),
      ) &&
      /\b[A-Za-z_]*model[A-Za-z0-9_]*\s*[:=]/i.test(text)
    ) {
      return {
        sourceKind: /(?:process\.env|Deno\.env|import\.meta\.env|os\.(?:environ|getenv))/.test(text)
          ? "environment"
          : "hardcoded",
        confidence: "medium",
        sdk: null,
      };
    }
  }
  return null;
}

function modelIdByteRange(node: SgNode, modelId: string): { start: number; end: number } {
  const offset = Buffer.byteLength(node.text().slice(0, node.text().indexOf(modelId)), "utf8");
  const start = node.range().start.index + offset;
  return { start, end: start + Buffer.byteLength(modelId, "utf8") };
}

function runtimeSourceKind(text: string): "environment" | "dynamic" {
  return /(?:process\.env|Deno\.env|import\.meta\.env|os\.(?:environ|getenv)|environ\.get)/.test(
    text,
  )
    ? "environment"
    : "dynamic";
}

export function analyzeCode(
  relativePath: string,
  content: string,
  entries: Map<string, LifecycleEntry>,
): Finding[] {
  const extension = path.extname(relativePath).toLowerCase();
  const language =
    extension === ".py"
      ? "python"
      : extension === ".tsx" || extension === ".jsx"
        ? Lang.Tsx
        : extension === ".ts"
          ? Lang.TypeScript
          : Lang.JavaScript;
  const root = parse(language, content).root();
  const findings: Finding[] = [];
  const seen = new Set<string>();

  walk(root, (node) => {
    const value = stringValue(node);
    const entry = value ? entries.get(value) : undefined;
    if (!entry) {
      return;
    }
    const context = modelContext(node, content, entry.provider);
    if (!context) {
      return;
    }
    const byteRange = modelIdByteRange(node, entry.modelId);
    const range = node.range();
    const location = toLocation(
      relativePath,
      range.start.line,
      range.start.column,
      byteRange.start,
      byteRange.end,
    );
    const id = findingId("model", location, entry.modelId);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const finding: ModelFinding = {
      id,
      kind: "model_reference",
      provider: entry.provider,
      modelId: entry.modelId,
      status: entry.status,
      shutdownDate: entry.shutdownDate,
      replacement: entry.replacement,
      sourceUrl: entry.sourceUrl,
      sourceKind: context.sourceKind,
      confidence: context.confidence,
      replacementConfidence: entry.replacementConfidence,
      sdk: context.sdk,
      location,
      message: `${entry.modelId} is ${entry.status}; official replacement: ${entry.replacement}`,
    };
    findings.push(finding);
  });

  walk(root, (node) => {
    if (!["call", "call_expression"].includes(String(node.kind()))) {
      return;
    }
    const sdk = detectSdkCall(node.text(), content);
    if (!sdk) {
      return;
    }
    const argument = modelArgument(node);
    if (!argument) {
      return;
    }
    const expression = argument.text().replace(/^\s*(?:model|modelId|model_id)\s*[:=]\s*/, "");
    const sourceKind = runtimeSourceKind(expression);
    const literalModel = hasLiteralModelInNode(argument);
    if (literalModel && sourceKind !== "environment") {
      return;
    }
    const range = argument.range();
    const location = toLocation(
      relativePath,
      range.start.line,
      range.start.column,
      range.start.index,
      range.end.index,
    );
    const id = findingId("runtime", location, sdk.provider);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const finding: RuntimeCheckFinding = {
      id,
      kind: "runtime_check",
      provider: sdk.provider,
      expression: expression.slice(0, 240),
      confidence: "low",
      sdk: sdk.name,
      location,
      message:
        sourceKind === "environment"
          ? "Model value can be overridden at runtime; verify the deployed environment value."
          : "Model expression is not statically resolvable; runtime confirmation is required.",
    };
    findings.push(finding);
  });

  return findings;
}

const MODEL_KEYS = new Set([
  "model",
  "modelid",
  "model_id",
  "openai_model",
  "anthropic_model",
  "gemini_model",
  "google_model",
]);

function byteOffset(content: string, characterOffset: number): number {
  return Buffer.byteLength(content.slice(0, characterOffset), "utf8");
}

export function analyzeConfig(
  relativePath: string,
  content: string,
  entries: Map<string, LifecycleEntry>,
): ModelFinding[] {
  const findings: ModelFinding[] = [];
  let characterOffset = 0;
  const lines = content.split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
      characterOffset += line.length + 1;
      continue;
    }
    const pairs = line.matchAll(
      /["']?([A-Za-z_][A-Za-z0-9_-]*)["']?\s*[:=]\s*["']?([^"',#\s}]+)["']?/g,
    );
    for (const pair of pairs) {
      const key = pair[1]?.toLowerCase() ?? "";
      const modelId = pair[2] ?? "";
      const entry = MODEL_KEYS.has(key) ? entries.get(modelId) : undefined;
      if (!entry) {
        continue;
      }
      const pairOffset = pair.index ?? 0;
      const column = pairOffset + pair[0].indexOf(modelId);
      const modelCharacterOffset = characterOffset + column;
      const start = byteOffset(content, modelCharacterOffset);
      const location = toLocation(relativePath, index, column, start, start + modelId.length);
      findings.push({
        id: findingId("model", location, modelId),
        kind: "model_reference",
        provider: entry.provider,
        modelId,
        status: entry.status,
        shutdownDate: entry.shutdownDate,
        replacement: entry.replacement,
        sourceUrl: entry.sourceUrl,
        sourceKind: relativePath.split("/").at(-1)?.startsWith(".env") ? "environment" : "config",
        confidence: "high",
        replacementConfidence: entry.replacementConfidence,
        sdk: null,
        location,
        message: `${modelId} is ${entry.status}; official replacement: ${entry.replacement}`,
      });
    }
    characterOffset += line.length + 1;
  }
  return findings;
}
