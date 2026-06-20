import { writeRegistry } from "../../src/registry/writers/registry-writer.js";
import type { ActionRegistry } from "../../src/registry/types.js";

/**
 * Temporary writer test.
 */
async function main(): Promise<void> {

  const registry: ActionRegistry = {
    version: "2.0",

    appId: "demo-app",

    checksum: "abc123",

    actions: [
      {
        id: "open_tasks",
        type: "navigation",
        description:
          "Navigate user to the tasks page",

        path: "/tasks",
      },
    ],
  };

  const path =
    await writeRegistry(registry);

  console.log(
    "Registry written to:",
    path,
  );
}

main().catch(console.error);