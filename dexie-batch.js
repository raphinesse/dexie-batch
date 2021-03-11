const { Promise } = require('dexie')

module.exports = class DexieBatch {
  constructor(opts) {
    assertValidOptions(opts)
    this.opts = opts
  }

  isParallel() {
    return Boolean(this.opts.limit)
  }

  each(collection, callback) {
    assertValidMethodArgs(...arguments)

    return this.eachBatch(collection, (batch, batchIdx) => {
      const baseIdx = batchIdx * this.opts.batchSize
      return Promise.all(batch.map((item, i) => callback(item, baseIdx + i)))
    })
  }

  eachBatch(collection, callback) {
    assertValidMethodArgs(...arguments)

    const delegate = this.isParallel() ? 'eachBatchParallel' : 'eachBatchSerial'
    return this[delegate](collection, callback)
  }

  eachBatchParallel(collection, callback) {
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

  eachBatchSerial(collection, callback) {
    assertValidMethodArgs(...arguments)

    const cbResults = []
    const nextBatch = batchIterator(collection, this.opts.batchSize)

    const nextUnlessEmpty = batch => {
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
function batchIterator(collection, batchSize) {
  const it = collection.clone()
  return () => {
    const batchPromise = it.clone().limit(batchSize).toArray()
    it.offset(batchSize)
    return batchPromise
  }
}

function assertValidOptions(opts) {
  const batchSize = opts && opts.batchSize
  if (!(batchSize && Number.isInteger(batchSize) && batchSize > 0)) {
    throw new Error('Mandatory option "batchSize" must be a positive integer')
  }

  if ('limit' in opts && !(Number.isInteger(opts.limit) && opts.limit >= 0)) {
    throw new Error('Option "limit" must be a non-negative integer')
  }
}

function assertValidMethodArgs(collection, callback) {
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
function isCollectionInstance(obj) {
  if (!obj) return false
  return ['clone', 'offset', 'limit', 'toArray'].every(
    name => typeof obj[name] === 'function'
  )
}
