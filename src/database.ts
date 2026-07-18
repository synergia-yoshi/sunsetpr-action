import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LifecycleDatabase, LifecycleEntry } from "./types.js";

const PROVIDERS = new Set(["openai", "anthropic", "gemini"]);
const STATUSES = new Set(["deprecated", "retired"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

function defaultDatabasePath(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDirectory, "../../data/lifecycle.json");
}

function validateEntry(value: unknown, index: number): asserts value is LifecycleEntry {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Lifecycle entry ${index} is not an object`);
  }
  const entry = value as Record<string, unknown>;
  if (!PROVIDERS.has(String(entry.provider))) {
    throw new Error(`Lifecycle entry ${index} has an unsupported provider`);
  }
  if (!STATUSES.has(String(entry.status))) {
    throw new Error(`Lifecycle entry ${index} has an unsupported status`);
  }
  if (!CONFIDENCES.has(String(entry.replacementConfidence))) {
    throw new Error(`Lifecycle entry ${index} has an invalid replacement confidence`);
  }
  for (const key of ["modelId", "shutdownDate", "replacement", "sourceUrl", "notes"]) {
    if (typeof entry[key] !== "string" || entry[key].length === 0) {
      throw new Error(`Lifecycle entry ${index} is missing ${key}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.shutdownDate))) {
    throw new Error(`Lifecycle entry ${index} has an invalid shutdown date`);
  }
  const source = new URL(String(entry.sourceUrl));
  if (source.protocol !== "https:") {
    throw new Error(`Lifecycle entry ${index} must use an HTTPS source URL`);
  }
}

export async function loadDatabase(explicitPath?: string): Promise<LifecycleDatabase> {
  const databasePath = explicitPath ? path.resolve(explicitPath) : defaultDatabasePath();
  const parsed = JSON.parse(await readFile(databasePath, "utf8")) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Lifecycle database root must be an object");
  }
  const database = parsed as Record<string, unknown>;
  if (
    !Number.isInteger(database.version) ||
    typeof database.checkedAt !== "string" ||
    !Array.isArray(database.entries)
  ) {
    throw new Error("Lifecycle database is missing version, checkedAt, or entries");
  }
  database.entries.forEach(validateEntry);
  const modelIds = new Set<string>();
  for (const entry of database.entries) {
    if (modelIds.has(entry.modelId)) {
      throw new Error(`Duplicate model ID in lifecycle database: ${entry.modelId}`);
    }
    modelIds.add(entry.modelId);
  }
  return {
    version: database.version as number,
    checkedAt: database.checkedAt,
    entries: database.entries,
  };
}
