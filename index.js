import Dexie from 'dexie'

const Promise = Dexie.Promise

export default class DexieBatch {
  constructor(opts = { batchSize: 20 }) {
    this.opts = opts
  }

  each(collection, callback) {
    return this.eachBatch(collection, a => {
      return Promise.all(a.map(callback))
    })
  }

  eachBatch(collection, callback) {
    const delegate = this.opts.limit ? 'eachBatchParallel' : 'eachBatchSerial'
    return this[delegate](collection, callback)
  }

  eachBatchParallel(collection, callback) {
    const batchSize = this.opts.batchSize
    const batchPromises = []

    for (let i = 0; i * batchSize < this.opts.limit; i++) {
      const batchPromise = collection
        .clone()
        .offset(i * batchSize)
        .limit(batchSize)
        .toArray()
        .then(a => callback(a, i))
      batchPromises.push(batchPromise)
    }
    return Dexie.Promise.all(batchPromises).then(batches => batches.length)
  }

  eachBatchSerial(collection, callback) {
    const batchSize = this.opts.batchSize
    const batchPromise = collection.clone().limit(batchSize).toArray()

    batchPromise.then(callback)

    return batchPromise.then(batch => {
      return batch.length
        ? this.eachBatch(collection.clone().offset(batchSize), callback)
        : undefined
    })
  }
}
