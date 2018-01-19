// Fake IndexedDB in global scope
require('fake-indexeddb/build/global')

const test = require('blue-tape')
const Dexie = require('dexie')
const DexieBatch = require('./dexie-batch')

const noop = _ => {}
const numEntries = 42
const batchSize = 10
const expectedBatchCount = 5
const testEntries = Array.from(Array(numEntries), (_, i) => i)

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
        return new Promise(r => setTimeout(r, 10)).then(_ => resolvedCount++)
      })
      .then(batchCount => {
        t.deepEqual(indices, entries, 'indices calculated correctly')

        // parallel batch driver may yield batches out of order
        if (batchDriver.isParallel()) {
          entries.sort((a, b) => a - b)
        }

        t.deepEqual(entries, testEntries, 'entries read correctly')
        t.equal(resolvedCount, numEntries, 'waited for user promises')
        t.equal(batchCount, expectedBatchCount, 'correct batch count')
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
        batchSizes = Array.from(batchSizes.values())
        // parallel batch driver may yield batches out of order
        if (batchDriver.isParallel()) {
          batchSizes.sort((a, b) => b - a)
        }

        t.equal(batchSizes[0], batchSize, 'correct batch size')
        t.equal(batchSizes.length, 2, 'only last batch size different')
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
  t.end()
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
  test(name, t =>
    Dexie.delete(name).then(_ => {
      const db = new Dexie(name)
      db.version(1).stores({ test: '++' })
      return db.test
        .bulkAdd(testEntries)
        .then(_ => f(t, db.test.toCollection()))
    })
  )
}
