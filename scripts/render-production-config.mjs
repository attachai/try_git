import { readFile, writeFile } from "node:fs/promises";

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!databaseId) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID is required.");
}

const template = await readFile("wrangler.production.template.jsonc", "utf8");
if (!template.includes("__D1_DATABASE_ID__")) {
  throw new Error("Production Wrangler template placeholder is missing.");
}

await writeFile(
  "wrangler.production.jsonc",
  template.replace("__D1_DATABASE_ID__", databaseId),
  "utf8",
);

console.log("Rendered wrangler.production.jsonc");
