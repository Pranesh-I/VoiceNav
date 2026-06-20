import { generateChecksum } from "../../src/registry/checksum/checksum-generator.js";
import type { ActionEntry } from "../../src/registry/types.js";

/**
 * Temporary test for checksum generation.
 */
function main(): void {
  const actions: ActionEntry[] = [
    {
      id: "open_tasks",
      type: "navigation",
      description: "Navigate user to the tasks page",
      path: "/tasks",
    },
    {
      id: "create_task",
      type: "handler",
      description: "Create and assign a new task",
      handler: "createTask",
    },
  ];

  const checksum = generateChecksum(actions);

  console.log("\n=== CHECKSUM TEST ===");
  console.log("Checksum:");
  console.log(checksum);

  console.log("\nLength:");
  console.log(checksum.length);

  console.log("\nIs Valid SHA-256:");
  console.log(/^[a-f0-9]{64}$/i.test(checksum));
}

main();