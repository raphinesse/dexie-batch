// Fake IndexedDB in global scope
// eslint-disable-next-line import/no-unassigned-import
require('fake-indexeddb/auto')

const test = require('ava')
const Dexie = require('dexie')
const DexieBatch = require('./helpers/dexie-batch')

const noop = _ => {}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const numEntries = 42
const batchSize = 10
const expectedBatchCount = 5
const testEntries = [...new Array(numEntries)].map((_, i) => i)

const serialBatchDriver = new DexieBatch({ batchSize })
const parallelBatchDriver = new DexieBatch({ batchSize, limit: numEntries })

testBasicOperation(serialBatchDriver)
testBasicOperation(parallelBatchDriver)

function testBasicOperation(batchDriver) {
  const mode = batchDriver.isParallel() ? 'parallel' : 'serial'
  testWithCollection(`${mode} driver: basic operation`, (t, collection) => {
    const entries = []
    const indices = []
    let resolvedCount = 0

    return batchDriver
      .each(collection, (entry, i) => {
        entries.push(entry)
        indices.push(i)
        return delay(10).then(_ => resolvedCount++)
      })
      .then(batchCount => {
        t.deepEqual(indices, entries, 'indices calculated correctly')

        // Parallel batch driver may yield batches out of order
        if (batchDriver.isParallel()) {
          entries.sort((a, b) => a - b)
        }

        t.deepEqual(entries, testEntries, 'entries read correctly')
        t.is(resolvedCount, numEntries, 'waited for user promises')
        t.is(batchCount, expectedBatchCount, 'correct batch count')
      })
  })
}

testBatchProperties(serialBatchDriver)
testBatchProperties(parallelBatchDriver)

function testBatchProperties(batchDriver) {
  const mode = batchDriver.isParallel() ? 'parallel' : 'serial'
  testWithCollection(`${mode} driver: batch properties`, (t, collection) => {
    let batchSizes = new Set()

    return batchDriver
      .eachBatch(collection, batch => {
        batchSizes.add(batch.length)
      })
      .then(_ => {
        batchSizes = [...batchSizes.values()]
        // Parallel batch driver may yield batches out of order
        if (batchDriver.isParallel()) {
          batchSizes.sort((a, b) => b - a)
        }

        t.is(batchSizes[0], batchSize, 'correct batch size')
        t.is(batchSizes.length, 2, 'only last batch size different')
      })
  })
}

test('constructor argument checking', t => {
  t.throws(_ => new DexieBatch(), /batchSize/)
  t.throws(_ => new DexieBatch(null), /batchSize/)
  t.throws(_ => new DexieBatch(1), /batchSize/)
  t.throws(_ => new DexieBatch('foo'), /batchSize/)
  t.throws(_ => new DexieBatch({}), /batchSize/)
  t.throws(_ => new DexieBatch({ batchSize: 0 }), /batchSize/)

  t.throws(_ => new DexieBatch({ batchSize, limit: -1 }), /limit/)
})

testWithCollection('method argument checking', (t, collection) => {
  const driver = parallelBatchDriver
  ;['each', 'eachBatch', 'eachBatchParallel', 'eachBatchSerial']
    .map(method => driver[method].bind(driver))
    .forEach(method => {
      t.throws(_ => method(), /mandatory/)

      t.throws(_ => method(null, noop), /Collection/)
      t.throws(_ => method(1, noop), /Collection/)
      t.throws(_ => method([1, 2], noop), /Collection/)

      t.throws(_ => method(collection), /mandatory/)
      t.throws(_ => method(collection, null), /function/)
      t.throws(_ => method(collection, 1), /function/)
    })
})

testWithCollection('no limit, no parallel operation', (t, collection) => {
  t.throws(_ => serialBatchDriver.eachBatchParallel(collection, noop), /limit/)
})

function testWithCollection(name, f) {
  test(name, async t => {
    await Dexie.delete(name)
    const db = new Dexie(name)
    db.version(1).stores({ test: '++' })
    await db.test.bulkAdd(testEntries)
    await f(t, db.test.toCollection())
  })
}
