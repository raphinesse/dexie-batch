# `dexie-batch`

Fetch IndexedDB entries in batches to improve performance while avoiding errors like *Maximum IPC message size exceeded*.

## Installation

```shell
npm i dexie-batch
```

## Usage

```js
import DexieBatch from 'dexie'
import table from './my-awesome-dexie-table'

const collection = table.toCollection()

const dbPromise = table.count()
  .then(n => new DexieBatch({ batchSize: 25, limit: n }))

dbPromise
  .then(db => db.each(collection, (entry, idxInBatch) => {
    // Process each item individually
  }))
  .then(() => console.log('Finished batch operation'))

dbPromise
  .then(db => db.eachBatch(collection, batch => {
    // Process each batch (array of entries) individually
  }))
  .then(() => console.log('Finished batch operation'))

```

The returned `Dexie.Promise` resolves when all batch operations have finished. If the user callback returns a `Promise` it is waited upon.

The `batchSize` option is mandatory since a sensible value depends strongly on the individual record size.

Batches are requested in parallel iff `limit` option is present.
Otherwise we would not know when to stop sending requests.
When limit is not given, batches are requested serially until one request gives an empty result.
