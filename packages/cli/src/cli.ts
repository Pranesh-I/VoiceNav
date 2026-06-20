#!/usr/bin/env node

import { discoverCapabilities } from './discovery/index.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  }

  if (command !== 'scan') {
    console.error('Usage: voicenav scan [--out path/to/output.json]');
    process.exit(1);
  }

  console.log('🚀 Starting VoiceNav Capability Discovery...');
  const start = performance.now();

  try {
    const cwd = process.cwd();
    const graph = await discoverCapabilities(cwd);
    
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
