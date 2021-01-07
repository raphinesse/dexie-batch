const path = require('path')
const tsNode = require('ts-node')
const tsConfigPaths = require('tsconfig-paths')

// Compile TypeScript tests on the fly
tsNode.register()

// Allows changing the file we load when importing 'dexie-batch'
tsConfigPaths.register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: {
    'dexie-batch': [process.env.TEST_SUBJECT || 'dexie-batch'],
  },
})
