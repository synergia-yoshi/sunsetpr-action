import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error(
    `SunsetPR Action v0 supports Linux x64 runners; received ${process.platform}-${process.arch}`,
  );
}

const nativeBinding = path.join(directory, "ast-grep-napi.linux-x64-gnu.node");
const pythonParser = path.join(directory, "python-parser", "parser.so");
await access(nativeBinding);
await access(pythonParser);
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = nativeBinding;
process.env.SUNSETPR_PYTHON_PARSER = pythonParser;

const { main } = await import("./index.js");
try {
  await main();
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`SunsetPR action failed: ${message}\n`);
  process.exitCode = 1;
}
