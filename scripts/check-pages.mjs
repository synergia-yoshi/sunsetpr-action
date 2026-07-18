import { access, readFile } from "node:fs/promises";
import path from "node:path";

const database = JSON.parse(await readFile("data/lifecycle.json", "utf8"));
const manifest = JSON.parse(await readFile("_site/pages-manifest.json", "utf8"));
if (manifest.entries !== database.entries.length || manifest.urls !== database.entries.length + 2) {
  throw new Error("GitHub Pages manifest does not match lifecycle database");
}

const sitemap = await readFile("_site/sitemap.xml", "utf8");
const locations = sitemap.match(/<loc>/gu) ?? [];
if (locations.length !== database.entries.length + 2) {
  throw new Error(`Expected ${database.entries.length + 2} sitemap URLs; received ${locations.length}`);
}

for (const entry of database.entries) {
  const file = path.join("_site/models", encodeURIComponent(entry.modelId), "index.html");
  await access(file);
  const page = await readFile(file, "utf8");
  for (const expected of [entry.modelId, entry.shutdownDate, entry.replacement, entry.sourceUrl]) {
    if (!page.includes(expected.replaceAll("&", "&amp;"))) {
      throw new Error(`${file} does not contain expected lifecycle evidence`);
    }
  }
  if (!page.includes("application/ld+json") || !page.includes("never auto-merge")) {
    throw new Error(`${file} is missing structured evidence or safety copy`);
  }
}

const catalog = await readFile("_site/models/index.html", "utf8");
if (!catalog.includes(`Exact IDs, shutdown dates`) || !catalog.includes(`${database.entries.length}`)) {
  throw new Error("Lifecycle catalog is missing its declared scope");
}
await access("_site/lifecycle.json");
await access("_site/robots.txt");

process.stdout.write(`Verified ${database.entries.length} model pages and ${locations.length} sitemap URLs.\n`);
