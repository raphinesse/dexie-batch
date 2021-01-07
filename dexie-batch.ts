import { Dexie } from 'dexie'

// Alias Dexie.Promise type & ctor to avoid accidental usage of vanilla Promise
import Promise = Dexie.Promise
const Promise = Dexie.Promise

// Alias for Dexie.Collection w/ unknown Key (since we never use any)
type Collection<T> = Dexie.Collection<T, unknown>

declare namespace DexieBatch {
  interface Options {
    batchSize: number
    limit?: number
  }

  /** If this returns a Promise, the calling method will wait on it */
  type Callback<T> = (item: T, index: number) => unknown
}
import Options = DexieBatch.Options
import Callback = DexieBatch.Callback

class DexieBatch {
  private readonly opts: Options

  constructor(opts: Options) {
    assertValidOptions(opts)
    this.opts = opts
  }

  isParallel(): boolean {
    return Boolean(this.opts.limit)
  }

  each<T>(collection: Collection<T>, callback: Callback<T>): Promise<number> {
    assertValidMethodArgs(...arguments)

    return this.eachBatch(collection, (batch, batchIdx) => {
      const baseIdx = batchIdx * this.opts.batchSize
      return Promise.all(batch.map((item, i) => callback(item, baseIdx + i)))
    })
  }

  eachBatch<T>(
    collection: Collection<T>,
    callback: Callback<T[]>
  ): Promise<number> {
    assertValidMethodArgs(...arguments)

    const delegate = this.isParallel() ? 'eachBatchParallel' : 'eachBatchSerial'
    return this[delegate](collection, callback)
  }

  eachBatchParallel<T>(
    collection: Collection<T>,
    callback: Callback<T[]>
  ): Promise<number> {
    assertValidMethodArgs(...arguments)
    const { batchSize, limit } = this.opts
    if (!limit) {
      throw new Error('Option "limit" must be set for parallel operation')
    }

    const nextBatch = batchIterator(collection, batchSize)
    const numBatches = Math.ceil(limit / batchSize)
    const batchPromises = Array.from({ length: numBatches }, (_, idx) =>
      nextBatch().then(batch => callback(batch, idx))
    )

    return Promise.all(batchPromises).then(batches => batches.length)
  }

  eachBatchSerial<T>(
    collection: Collection<T>,
    callback: Callback<T[]>
  ): Promise<number> {
    assertValidMethodArgs(...arguments)

    const cbResults: unknown[] = []
    const nextBatch = batchIterator(collection, this.opts.batchSize)

    const nextUnlessEmpty = (batch: T[]): unknown => {
      if (batch.length === 0) return
      cbResults.push(callback(batch, cbResults.length))
      return nextBatch().then(nextUnlessEmpty)
    }

    return nextBatch()
      .then(nextUnlessEmpty)
      .then(() => Promise.all(cbResults))
      .then(() => cbResults.length)
  }
}

// Does not conform to JS iterator requirements
function batchIterator<T>(collection: Collection<T>, batchSize: number) {
  const it = collection.clone()
  return () => {
    const batchPromise = it.clone().limit(batchSize).toArray()
    it.offset(batchSize)
    return batchPromise
  }
}

function assertValidOptions(opts: Options): void {
  const batchSize = opts?.batchSize
  if (!(batchSize && Number.isInteger(batchSize) && batchSize > 0)) {
    throw new Error('Mandatory option "batchSize" must be a positive integer')
  }

  if ('limit' in opts && !(Number.isInteger(opts.limit) && opts.limit! >= 0)) {
    throw new Error('Option "limit" must be a non-negative integer')
  }
}

function assertValidMethodArgs(collection?: unknown, callback?: unknown): void {
  if (arguments.length < 2) {
    throw new Error('Arguments "collection" and "callback" are mandatory')
  }

  if (!isCollectionInstance(collection)) {
    throw new Error('"collection" must be of type Collection')
  }

  if (!(typeof callback === 'function')) {
    throw new TypeError('"callback" must be a function')
  }
}

// We would need the Dexie instance that created the collection to get the
// Collection constructor and do some proper type checking.
// So for now we resort to duck typing
function isCollectionInstance(obj: any): boolean {
  if (!obj) return false
  return ['clone', 'offset', 'limit', 'toArray'].every(
    name => typeof obj[name] === 'function'
  )
}

export default DexieBatch
