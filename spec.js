// Fake IndexedDB in global scope
require('fake-indexeddb/build/global')

const test = require('blue-tape')
const Dexie = require('dexie')
const DexieBatch = require('./dexie-batch')

const numEntries = 42
const batchSize = 10
const testEntries = Array.from(Array(numEntries), (_, i) => i)

const serialBatchDriver = new DexieBatch({ batchSize })
const parallelBatchDriver = new DexieBatch({ batchSize, limit: numEntries })

testBasicOperation(serialBatchDriver)
testBasicOperation(parallelBatchDriver)

function testBasicOperation(batchDriver) {
  const mode = batchDriver.isParallel() ? 'parallel' : 'serial'
  testWithCollection(`${mode} driver: basic operation`, (t, collection) => {
    const entries = []

    return batchDriver
      .each(collection, (entry, i) => {
        entries.push(entry)
      })
      .then(_ => {
        // parallel batch driver may yield batches out of order
        if (batchDriver.isParallel()) {
          entries.sort((a, b) => a - b)
        }

        t.deepEqual(entries, testEntries, 'entries read correctly')
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
