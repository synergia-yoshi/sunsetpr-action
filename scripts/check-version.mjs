import { readFile } from "node:fs/promises";

const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
const versionSource = await readFile("src/version.ts", "utf8");
const match = versionSource.match(/TOOL_VERSION\s*=\s*"([^"]+)"/u);

if (!match) {
  throw new Error("Unable to read TOOL_VERSION from src/version.ts");
}
if (match[1] !== packageMetadata.version) {
  throw new Error(
    `Version mismatch: package.json=${packageMetadata.version}, src/version.ts=${match[1]}`,
  );
}

process.stdout.write(`Version metadata is consistent: ${packageMetadata.version}\n`);
