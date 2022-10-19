/* eslint-disable @typescript-eslint/no-floating-promises */
import test from 'node:test'
import assert from 'node:assert'

test('synchronous passing test', (t) => {
  // This test passes because it does not throw an exception.
  assert.strictEqual(1, 1)
})

test('top level test', async (t) => {
  await t.test('subtest 1', (t) => {
    assert.strictEqual(1, 1)
  })

  await t.test('subtest 2', (t) => {
    assert.strictEqual(2, 2)
  })
})
