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
  testWithCollection(`basic ${mode} operation`, (t, collection) => {
    let maxIdx = -1
    const entries = []

    return batchDriver
      .each(collection, (entry, i) => {
        entries.push(entry)
        maxIdx = Math.max(maxIdx, i)
      })
      .then(_ => {
        entries.sort((a, b) => a - b)
        t.equal(maxIdx + 1, batchSize, 'batches sized correctly')
        t.deepEqual(entries, testEntries, 'entries read correctly')
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
