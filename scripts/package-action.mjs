import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const platformNames = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};
const architectureNames = {
  arm64: "ARM64",
  x64: "X64",
};

const platformName = platformNames[process.platform];
const architectureName = architectureNames[process.arch];
if (!platformName || !architectureName) {
  throw new Error(`Unsupported Action build platform: ${process.platform}-${process.arch}`);
}

const source = path.resolve(
  "node_modules/@ast-grep/lang-python/prebuilds",
  `prebuild-${platformName}-${architectureName}`,
  "parser.so",
);
const destination = path.resolve("dist/action/python-parser/parser.so");
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);

const assets = [
  path.resolve("dist/action/index.js"),
  destination,
  ...(await import("node:fs/promises").then(({ readdir }) => readdir("dist/action")))
    .filter((name) => name.endsWith(".node"))
    .map((name) => path.resolve("dist/action", name)),
];
for (const asset of assets) {
  const metadata = await stat(asset);
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`Invalid packaged Action asset: ${asset}`);
  }
}

process.stdout.write(
  `Packaged SunsetPR Action for ${process.platform}-${process.arch} with ${assets.length} runtime assets.\n`,
);
