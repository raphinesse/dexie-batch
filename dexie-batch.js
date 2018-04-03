window.DexieBatch = class DexieBatch {
  constructor(opts) {
    assertValidOptions(opts)
    this.opts = opts
  }

  isParallel() {
    return !!this.opts.limit
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
    if (!this.opts.limit) {
      throw Error('Option "limit" must be set for parallel operation')
    }

    const batchSize = this.opts.batchSize
    const batchPromises = []

    for (let batchIdx = 0; batchIdx * batchSize < this.opts.limit; batchIdx++) {
      const batchPromise = collection
        .clone()
        .offset(batchIdx * batchSize)
        .limit(batchSize)
        .toArray()
        .then(batch => callback(batch, batchIdx))
      batchPromises.push(batchPromise)
    }
    return Promise.all(batchPromises).then(batches => batches.length)
  }

  eachBatchSerial(collection, callback, batchIdx = 0) {
    assertValidMethodArgs(...arguments)

    const batchSize = this.opts.batchSize
    return collection
      .clone()
      .limit(batchSize)
      .toArray()
      .then(batch => {
        if (!batch.length) return 0

        const userPromise = callback(batch, batchIdx)
        const nextBatchesPromise = this.eachBatchSerial(
          collection.clone().offset(batchSize),
          callback,
          batchIdx + 1
        )

        return Promise.all([userPromise, nextBatchesPromise]).then(
          ([, batchCount]) => batchCount + 1
        )
      })
  }
}

function assertValidOptions(opts) {
  const batchSize = opts && opts.batchSize
  if (!(batchSize && Number.isInteger(batchSize) && batchSize > 0)) {
    throw Error('Mandatory option "batchSize" must be a positive integer')
  }

  if ('limit' in opts && !(Number.isInteger(opts.limit) && opts.limit >= 0)) {
    throw Error('Option "limit" must be a non-negative integer')
  }
}

function assertValidMethodArgs(collection, callback) {
  if (arguments.length < 2) {
    throw Error('Arguments "collection" and "callback" are mandatory')
  }
  if (!isCollectionInstance(collection)) {
    throw Error('"collection" must be of type Collection')
  }
  if (!(typeof callback === 'function')) {
    throw Error('"callback" must be a function')
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
