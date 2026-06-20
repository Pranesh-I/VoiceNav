import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ActionRegistry } from "../types.js";
import { REGISTRY_FILE_NAME } from "../constants.js";

/**
 * Writes the generated registry
 * to voicenav.actions.json.
 */
export async function writeRegistry(
  registry: ActionRegistry,
  outputDir: string = process.cwd(),
): Promise<string> {

  const outputPath = resolve(
    outputDir,
    REGISTRY_FILE_NAME,
  );

  await mkdir(
    dirname(outputPath),
    { recursive: true },
  );

  await writeFile(
    outputPath,
    JSON.stringify(registry, null, 2),
    "utf-8",
  );

  return outputPath;
}