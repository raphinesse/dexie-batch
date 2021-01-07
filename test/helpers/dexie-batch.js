const testSubject = process.env.TEST_SUBJECT || 'dexie-batch'

module.exports = require(`../../dist/${testSubject}`)
