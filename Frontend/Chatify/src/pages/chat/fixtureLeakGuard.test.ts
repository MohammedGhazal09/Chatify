import { describe, expect, it } from 'vitest';

const blockedPatterns = [
  /Phase06VisualFixture/,
  /PHASE06_/,
  /phase06/,
  /chatVisualSmoke/,
  /message-states-spec/i,
  /delivery-metrics/i,
  /retry-logic-notes/i,
  /e2e\/fixtures/i,
];

const runtimeSource = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const runtimeEntries = Object.entries(runtimeSource).filter(([filePath]) => (
  !filePath.includes('.test.') &&
  !filePath.includes('.spec.')
));

describe('chat runtime fixture leak guard', () => {
  it('keeps Phase 06 visual fixture identifiers out of production chat runtime files', () => {
    const leakedFiles = runtimeEntries.filter(([, source]) => (
      typeof source === 'string' &&
      blockedPatterns.some((pattern) => pattern.test(source))
    ));

    expect(leakedFiles.map(([filePath]) => filePath)).toEqual([]);
  });
});
