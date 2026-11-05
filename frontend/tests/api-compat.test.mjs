import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import api from '../src/lib/api.js'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalAdapter = api.defaults.adapter

function browser(values = {}) {
  const storage = new Map(Object.entries(values))
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    removeItem: key => storage.delete(key),
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { href: '/before' } } })
  return storage
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
  for (const [key, descriptor] of [['localStorage', originalStorage], ['window', originalWindow]]) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

test('the actual API instance preserves API prefix, JSON payload and auth header', async () => {
  browser({ token: 'fixture-token' })
  let sent
  api.defaults.adapter = async config => {
    sent = config
    return { config, status: 200, statusText: 'OK', headers: {}, data: { ok: true } }
  }
  const response = await api.post('/auth/login', { email: 'fixture@example.invalid' })
  assert.equal(sent.baseURL, '/api/v1')
  assert.equal(sent.headers.Authorization, 'Bearer fixture-token')
  assert.deepEqual(JSON.parse(sent.data), { email: 'fixture@example.invalid' })
  assert.deepEqual(response.data, { ok: true })
})

for (const [url, identity, destination] of [
  ['/spots', { operator: '{}' }, '/login'],
  ['/customer/contracts', { customer: '{}' }, '/kunde/login'],
  ['/platform/tenants', { admin: '{}' }, '/admin/login'],
]) {
  test(`401 keeps the existing role redirect for ${url}`, async () => {
    const storage = browser({ token: 'fixture-token', ...identity })
    api.defaults.adapter = async config => { throw { config, response: { status: 401 } } }
    await assert.rejects(api.get(url))
    assert.equal(storage.has('token'), false)
    assert.equal(window.location.href, destination)
  })
}

test('failed login retains its form and does not trigger the global 401 redirect', async () => {
  browser()
  api.defaults.adapter = async config => { throw { config, response: { status: 401 } } }
  await assert.rejects(api.post('/auth/login', {}))
  assert.equal(window.location.href, '/before')
})
