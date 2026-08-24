import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowDirectory = resolve(process.cwd(), '../../.github/workflows');

describe('GitHub Actions supply-chain pinning', () => {
  it('pins every third-party action to an immutable commit SHA', () => {
    const workflows = readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/i.test(name));
    const mutableUses = [];

    for (const workflow of workflows) {
      const content = readFileSync(resolve(workflowDirectory, workflow), 'utf8');
      for (const match of content.matchAll(/^\s*-?\s*uses:\s*([^#\s]+)(?:\s*#.*)?$/gm)) {
        const reference = match[1];
        if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
        const version = reference.split('@').at(-1) ?? '';
        if (!/^[a-f0-9]{40}$/i.test(version)) {
          mutableUses.push(`${workflow}: ${reference}`);
        }
      }
    }

    expect(mutableUses).toEqual([]);
  });
});
