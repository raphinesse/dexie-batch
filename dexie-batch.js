const Promise = require('dexie').Promise

module.exports = class DexieBatch {
  constructor(opts = { batchSize: 20 }) {
    this.opts = opts
  }

  isParallel() {
    return !!this.opts.limit
  }

  each(collection, callback) {
    return this.eachBatch(collection, batch => {
      return Promise.all(batch.map(callback))
    })
  }

  eachBatch(collection, callback) {
    const delegate = this.isParallel() ? 'eachBatchParallel' : 'eachBatchSerial'
    return this[delegate](collection, callback)
  }

  eachBatchParallel(collection, callback) {
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

  eachBatchSerial(collection, callback) {
    const batchSize = this.opts.batchSize
    return collection
      .clone()
      .limit(batchSize)
      .toArray()
      .then(batch => {
        if (!batch.length) return
        callback(batch)
        return this.eachBatch(collection.clone().offset(batchSize), callback)
      })
  }
}
