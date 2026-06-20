import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRegistry }
  from "../../src/registry/orchestrator.js";

// resolve current file directory (IMPORTANT)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// build correct absolute path to JSON file
const filePath = path.join(
  __dirname,
  "voicenav.capabilities.json"
);

// read file safely
const capabilities = JSON.parse(
  fs.readFileSync(filePath, "utf-8")
);

const registry =
  buildRegistry(capabilities);

console.log(registry.actions.length);
console.log(registry.checksum);
console.log(
  JSON.stringify(
    capabilities[62],
    null,
    2,
  ),
);