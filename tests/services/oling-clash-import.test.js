const assert = require('node:assert/strict');
const test = require('node:test');

const {
  importVersionedRecords
} = require('../../server/services/olings/definitions/sync');

test('versioned Clash imports demote the previous current revision', async () => {
  const calls = [];
  const model = {
    async updateMany(filter, update) {
      calls.push({ method: 'updateMany', filter, update });
    },
    async findOneAndUpdate(filter, update, options) {
      calls.push({ method: 'findOneAndUpdate', filter, update, options });
      return update.$set;
    }
  };
  const destination = [];

  await importVersionedRecords({
    model,
    records: [
      {
        key: 'Moss-Mend',
        revision: 2,
        traitKey: 'Moss-Mouth',
        isCurrent: true,
        effects: []
      }
    ],
    destination,
    currentScope: 'traitKey',
    unsetFields: ['handler', 'parameters']
  });

  assert.deepEqual(calls[0], {
    method: 'updateMany',
    filter: {
      traitKey: 'moss-mouth',
      revision: { $ne: 2 },
      isCurrent: true
    },
    update: { $set: { isCurrent: false } }
  });
  assert.deepEqual(calls[1].filter, { traitKey: 'moss-mouth', revision: 2 });
  assert.deepEqual(calls[1].update.$unset, { handler: '', parameters: '' });
  assert.equal(calls[1].update.$set.status, 'published');
  assert.equal(calls[1].options.runValidators, true);
  assert.equal(calls[1].options.strict, false);
  assert.equal(destination.length, 1);
});

test('versioned Clash imports do not demote records for historical revisions', async () => {
  let demotionCount = 0;
  const model = {
    async updateMany() {
      demotionCount += 1;
    },
    async findOneAndUpdate(_filter, update) {
      return update.$set;
    }
  };

  await importVersionedRecords({
    model,
    records: [{ key: 'burn', revision: 1, isCurrent: false }],
    destination: [],
    currentScope: 'key'
  });

  assert.equal(demotionCount, 0);
});
