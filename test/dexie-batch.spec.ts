// Fake IndexedDB in global scope
// eslint-disable-next-line import/no-unassigned-import
require('fake-indexeddb/auto')

import test, { ExecutionContext } from 'ava'
import Dexie from 'dexie'
import DexieBatch from 'dexie-batch'

type Collection<T> = Dexie.Collection<T, unknown>

const noop = () => {}
// eslint-disable-next-line no-promise-executor-return
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const numEntries = 42
const batchSize = 10
const expectedBatchCount = 5
const testEntries = Array.from({ length: numEntries }, (_, i) => i)

const serialBatchDriver = new DexieBatch({ batchSize })
const parallelBatchDriver = new DexieBatch({ batchSize, limit: numEntries })

testBasicOperation(serialBatchDriver)
testBasicOperation(parallelBatchDriver)

function testBasicOperation(batchDriver: DexieBatch) {
  const mode = batchDriver.isParallel() ? 'parallel' : 'serial'
  testWithCollection(`${mode} driver: basic operation`, (t, collection) => {
    const entries: number[] = []
    const indices: number[] = []
    let resolvedCount = 0

    return batchDriver
      .each(collection, (entry, i) => {
        entries.push(entry)
        indices.push(i)
        return delay(10).then(() => resolvedCount++)
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

function testBatchProperties(batchDriver: DexieBatch) {
  const mode = batchDriver.isParallel() ? 'parallel' : 'serial'
  testWithCollection(`${mode} driver: batch properties`, (t, collection) => {
    const batchSizes: Set<number> = new Set()

    return batchDriver
      .eachBatch(collection, batch => {
        batchSizes.add(batch.length)
      })
      .then(() => {
        const sizes = [...batchSizes.values()]
        // Parallel batch driver may yield batches out of order
        if (batchDriver.isParallel()) {
          sizes.sort((a, b) => b - a)
        }

        t.is(sizes[0], batchSize, 'correct batch size')
        t.is(sizes.length, 2, 'only last batch size different')
      })
  })
}

test('constructor argument checking', t => {
  // Use any-typed alias to have TS let us pass invalid args
  const Ctor: any = DexieBatch

  t.throws(() => new Ctor(), { message: /batchSize/ })
  t.throws(() => new Ctor(null), { message: /batchSize/ })
  t.throws(() => new Ctor(1), { message: /batchSize/ })
  t.throws(() => new Ctor('foo'), { message: /batchSize/ })
  t.throws(() => new Ctor({}), { message: /batchSize/ })
  t.throws(() => new Ctor({ batchSize: 0 }), { message: /batchSize/ })

  t.throws(() => new Ctor({ batchSize, limit: -1 }), { message: /limit/ })
})

testWithCollection('method argument checking', (t, collection) => {
  const driver = parallelBatchDriver
  ;(['each', 'eachBatch', 'eachBatchParallel', 'eachBatchSerial'] as const)
    .map(method => driver[method].bind(driver))
    .forEach((method: any) => {
      t.throws(() => method(), { message: /mandatory/ })

      t.throws(() => method(null, noop), { message: /Collection/ })
      t.throws(() => method(1, noop), { message: /Collection/ })
      t.throws(() => method([1, 2], noop), { message: /Collection/ })

      t.throws(() => method(collection), { message: /mandatory/ })
      t.throws(() => method(collection, null), { message: /function/ })
      t.throws(() => method(collection, 1), { message: /function/ })
    })
})

testWithCollection('no limit, no parallel operation', (t, collection) => {
  t.throws(() => serialBatchDriver.eachBatchParallel(collection, noop), {
    message: /limit/,
  })
})

function testWithCollection(
  name: string,
  f: (t: ExecutionContext, c: Collection<number>) => unknown
) {
  test(name, async t => {
    await Dexie.delete(name)
    const db = new Dexie(name)
    db.version(1).stores({ test: '++' })
    const table = db.table<number, number>('test')
    await table.bulkAdd(testEntries)
    await f(t, table.toCollection())
  })
}
