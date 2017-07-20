const test = require('blue-tape')
const Dexie = require('dexie')
const DexieBatch = require('./dexie-batch')

const batchSize = 10
const testEntries = Array(42).fill().map((_, i) => i)

testWithTable('basic operation', (t, table) => {
  let maxIdx = -1
  const readEntries = []

  return table.count()
    .then(n => {
      t.is(n, testEntries.length, 'written right number of entries')
      return new DexieBatch({ batchSize, limit: n })
    })
    .then(db => db.each(table.toCollection(), (entry, i) => {
      readEntries.push(entry)
      maxIdx = Math.max(maxIdx, i)
    }))
    .then(_ => {
      readEntries.sort((a, b) => a - b)
      t.ok(maxIdx > 0, 'indices valid')
      t.ok(maxIdx < batchSize, 'batches sized correctly')
      t.deepEqual(readEntries, testEntries, 'entries read correctly')
    })
})

function testWithTable(name, f) {
  const db = new Dexie('test-db')
  db.version(1).stores({ test: '++' })
  db.test.bulkAdd(testEntries)
    .then(_ => test(name, t => {
      return f(t, db.test)
        .then(_ => db.delete())
        .catch(err => {
          db.delete()
          throw err
        })
    }))
}
