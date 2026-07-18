import { readdir } from "node:fs/promises";
import path from "node:path";

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".sunsetpr",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".venv",
  "venv",
  "__pycache__",
]);

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"]);

const CONFIG_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".ini", ".cfg"]);

export type SupportedFileKind = "code" | "config";

export interface SupportedFile {
  absolutePath: string;
  relativePath: string;
  kind: SupportedFileKind;
}

function classifyFile(filename: string): SupportedFileKind | null {
  if (filename === ".env" || filename.startsWith(".env.")) {
    return "config";
  }
  const extension = path.extname(filename).toLowerCase();
  if (CODE_EXTENSIONS.has(extension)) {
    return "code";
  }
  if (CONFIG_EXTENSIONS.has(extension)) {
    return "config";
  }
  return null;
}

export async function listSupportedFiles(root: string): Promise<SupportedFile[]> {
  const files: SupportedFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          await visit(absolutePath);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const kind = classifyFile(entry.name);
      if (kind) {
        files.push({
          absolutePath,
          relativePath: path.relative(root, absolutePath).split(path.sep).join("/"),
          kind,
        });
      }
    }
  }

  await visit(root);
  return files;
}
