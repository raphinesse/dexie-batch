# dexie-batch [![Build Status](https://travis-ci.org/raphinesse/dexie-batch.svg?branch=master)](https://travis-ci.org/raphinesse/dexie-batch)

Fetch IndexedDB entries in batches to improve performance while avoiding errors like *Maximum IPC message size exceeded*.

## Installation

If you are using some kind of module bundler:
```shell
npm i dexie-batch
```

Alternatively, you can use one of the [pre-built scripts](https://unpkg.com/dexie-batch/dist/) and include it *after* the script for `Dexie`:
```html
<script src="https://unpkg.com/dexie-batch/dist/dexie-batch.min.js"></script>
```
This way, `DexieBatch` will be available as a global variable.

## Usage

```js
import DexieBatch from 'dexie-batch'
import table from './my-awesome-dexie-table'

const collection = table.toCollection()

// Will fetch 99 items in batches of size 25 when used
const batchDriver = new DexieBatch({ batchSize: 25, limit: 99 })

// You can check if an instance will fetch batches concurrently
if (batchDriver.isParallel()) { // true in this case
  console.log('Fetching batches concurrently!')
}

batchDriver.each(collection, (entry, idx) => {
  // Process each item individually
}).then(n => console.log(`Fetched ${n} batches`))

batchDriver.eachBatch(collection, (batch, batchIdx) => {
  // Process each batch (array of entries) individually
}).then(n => console.log(`Fetched ${n} batches`))
```

The returned `Dexie.Promise` resolves when all batch operations have finished. If the user callback returns a `Promise` it is waited upon.

The `batchSize` option is mandatory since a sensible value depends strongly on the individual record size.

Batches are requested in parallel iff `limit` option is present.
Otherwise we would not know when to stop sending requests.
When no limit is given, batches are requested serially until one request gives an empty result.
