#!/usr/bin/env node

import { discoverCapabilities } from './discovery/index.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildRegistry } from './registry/orchestrator.js';
import { writeRegistry } from './registry/writers/index.js';

async function main() {
  const args = process.argv.slice(2);
  let command = 'scan';
  let outPath = 'voicenav.capabilities.json';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outPath = args[i + 1]!;
      i++;
    } else if (args[i] === 'scan') {
      command = 'scan';
    }
    else if (args[i] === 'registry') {
      command = 'registry';
    }
  }

  if (
    command !== 'scan' &&
    command !== 'registry'
  ) {
    console.error(`
      Usage:

      voicenav scan
      voicenav registry

      Optional:
      --out <path>
    `);
    process.exit(1);
  }

  console.log(
  command === 'registry'
      ? '🚀 Starting VoiceNav Registry Generation...'
      : '🚀 Starting VoiceNav Capability Discovery...'
  );
  const start = performance.now();

  try {
    const cwd = process.cwd();
    const graph = await discoverCapabilities(cwd);

    if (command === 'registry') {

      const registry =
        buildRegistry(graph);

      const outputPath =
        await writeRegistry(
          registry,
          cwd,
        );

      const end = performance.now();
      const durationMs = end - start;

      console.log('\n--- VoiceNav Registry Summary ---');
      console.log(
        `Actions Generated : ${registry.actions.length}`
      );
      console.log(
        `Checksum          : ${registry.checksum}`
      );
      console.log(
        `Execution Time    : ${(durationMs / 1000).toFixed(2)}s`
      );
      console.log(
        `Output written to : ${outputPath}`
      );
      console.log('---------------------------------\n');

      return;
    }
    
    const end = performance.now();
    const durationMs = end - start;

    // Save
    const fullOutPath = resolve(cwd, outPath);
    writeFileSync(fullOutPath, JSON.stringify(graph, null, 2), 'utf-8');

    // Aggregate counts
    const counts: Record<string, number> = {
      route: 0,
      handler: 0,
      api_endpoint: 0,
      ui_action: 0
    };

    for (const cap of graph) {
      if (counts[cap.type] !== undefined) {
        counts[cap.type] = counts[cap.type]! + 1;
      } else {
        counts[cap.type] = 1;
      }
    }

    // Print summary
    console.log('\n--- VoiceNav Discovery Summary ---');
    console.table(counts);
    console.log(`Total Capabilities : ${graph.length}`);
    console.log(`Execution Time     : ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`Output written to  : ${outPath}`);
    console.log('----------------------------------\n');

  } catch (err) {
    console.error('❌ Discovery failed:', err);
    process.exit(1);
  }
}

main();
