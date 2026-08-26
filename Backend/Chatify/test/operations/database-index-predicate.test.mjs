import { describe, expect, it } from 'vitest';
import { evaluateIndexDefinitions } from '../../Utils/databaseIndexPolicy.mjs';

describe('critical database partial-index predicates', () => {
  it('marks an index mismatched when its predicate grants a different state set', () => {
    const requirements = [{
      id: 'active-record.unique-partial',
      modelName: 'Example',
      collectionName: 'examples',
      keys: { ownerId: 1 },
      options: {
        unique: true,
        partialFilterExpression: {
          status: { $in: ['active', 'pending'] },
        },
      },
    }];
    const report = evaluateIndexDefinitions({
      requirements,
      getIndexes: () => [{
        name: 'wrong_partial_index',
        keys: { ownerId: 1 },
        options: {
          unique: true,
          partialFilterExpression: {
            status: { $in: ['disabled'] },
          },
        },
      }],
    });

    expect(report.ok).toBe(false);
    expect(report.mismatched).toEqual([
      expect.objectContaining({
        id: 'active-record.unique-partial',
        differences: [expect.stringMatching(/partialFilterExpression/)],
      }),
    ]);
  });
});
