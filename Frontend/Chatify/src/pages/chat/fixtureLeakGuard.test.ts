import { describe, expect, it } from 'vitest';

const blockedPatterns = [
  { label: 'Phase 06 fixture module', pattern: /Phase06VisualFixture/ },
  { label: 'Phase 06 constants', pattern: /PHASE06_/ },
  { label: 'Phase 06 identifiers', pattern: /phase06/ },
  { label: 'Phase 07 constants', pattern: /PHASE07_/ },
  { label: 'Phase 07 identifiers', pattern: /phase07/ },
  { label: 'Phase 09 constants', pattern: /PHASE09_/ },
  { label: 'Phase 09 identifiers', pattern: /phase09/ },
  { label: 'Phase 10 identifiers', pattern: /phase10/i },
  { label: 'visual smoke fixture names', pattern: /chatVisualSmoke/ },
  { label: 'e2e fixture imports', pattern: /e2e\/fixtures/i },
  { label: 'reference file name', pattern: /message-states-spec/i },
  { label: 'reference file name', pattern: /Chatify[_ -]?Message[_ -]?States[_ -]?Spec/i },
  { label: 'reference file name', pattern: /delivery-metrics/i },
  { label: 'reference file name', pattern: /delivery[_ -]?matrix/i },
  { label: 'reference file name', pattern: /message[_ -]?state[_ -]?diagram/i },
  { label: 'reference file name', pattern: /retry-logic-notes/i },
  { label: 'Phase 07 fixture title', pattern: /Relay Node/i },
  { label: 'Phase 07 fixture title', pattern: /Matrix Sync/i },
  { label: 'Phase 09 fixture title', pattern: /Relay Grid/i },
  { label: 'Phase 09 fixture title', pattern: /Vector Archive/i },
  { label: 'Phase 09 fixture title', pattern: /Cipher Vault/i },
  { label: 'production screenshot fixture title', pattern: /Mohammed Ghazal/i },
  { label: 'production screenshot fixture title', pattern: /MrKing09/i },
  { label: 'production screenshot fixture title', pattern: /sdsdsdsds/i },
  { label: 'static call fixture', pattern: /call[_-]?visual[_-]?fixture/i },
  { label: 'static call fixture', pattern: /static[_-]?call[_-]?(card|history|state)/i },
  { label: 'static call fixture', pattern: /demo[_-]?call[_-]?(card|history|state)/i },
  { label: 'static call fixture', pattern: /fake[_-]?call[_-]?(card|history|state)/i },
  { label: 'private storage leak', pattern: /gridfs/i },
  { label: 'private storage leak', pattern: /(attachment|asset|object)[-_ ]?storage[-_ ]?key/i },
  { label: 'private storage leak', pattern: /storage[-_ ]?bucket/i },
  { label: 'private storage leak', pattern: /object[-_ ]?key/i },
  { label: 'private storage leak', pattern: /raw[-_ ]?hash/i },
  { label: 'private storage leak', pattern: /file[-_ ]?hash/i },
  { label: 'private storage leak', pattern: /sha256/i },
  { label: 'living visual fixture term', pattern: /profile[-_ ]?(pic|picture|photo)/i },
  { label: 'living visual fixture term', pattern: /realistic avatar/i },
  { label: 'living visual fixture term', pattern: /\b(human|animal|pet|bird|insect|plant|flower|tree|mascot|portrait|silhouette)\b/i },
];

const runtimeSource = import.meta.glob('./**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const runtimeEntries = Object.entries(runtimeSource).filter(([filePath]) => (
  !filePath.includes('.test.') &&
  !filePath.includes('.spec.')
));

describe('chat runtime fixture leak guard', () => {
  it('keeps test fixtures, private asset internals, and living visual fixture data out of production chat runtime files', () => {
    const leakedFiles = runtimeEntries.flatMap(([filePath, source]) => {
      if (typeof source !== 'string') {
        return [];
      }

      const matches = blockedPatterns
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${filePath}: ${label}`);

      return matches;
    });

    expect(leakedFiles).toEqual([]);
  });
});
