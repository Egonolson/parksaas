import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const root = new URL('../', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(root.href) && !context.parentURL.includes('/node_modules/')) {
      const path = new URL(specifier, context.parentURL)
      for (const extension of ['.jsx', '.js']) {
        const url = new URL(`${path.href}${extension}`)
        if (existsSync(url)) return { url: url.href, shortCircuit: true }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith(root.href) && new URL(url).pathname.endsWith('.jsx') && !url.includes('/node_modules/')) {
      return { format: 'module', shortCircuit: true, source: transformSync(readFileSync(new URL(url), 'utf8'), {
        loader: 'jsx', jsx: 'automatic', format: 'esm', target: 'es2022',
      }).code }
    }
    return next(url, context)
  },
})

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'Node']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = await import('react-dom/client')
let session = {}
mock.module(new URL('src/hooks/useAuth.jsx', root).href, { exports: {
  AuthProvider: ({ children }) => children,
  useAuth: () => session,
} })
for (const name of ['Layout', 'CustomerLayout', 'AdminLayout']) {
  mock.module(new URL(`src/components/${name}.jsx`, root).href, { exports: { default: ({ children }) => children } })
}
for (const name of ['Landing', 'Login', 'Register', 'Dashboard', 'Locations', 'Spots', 'Contracts', 'Payments',
  'Settings', 'PublicBooking', 'CustomerLogin', 'CustomerRegister', 'CustomerDashboard', 'CustomerProfile',
  'AdminLogin', 'AdminDashboard', 'Onboarding', 'BookingEmbed', 'NotFound']) {
  mock.module(new URL(`src/pages/${name}.jsx`, root).href, { exports: { default: () => React.createElement('p', null, name) } })
}
for (const name of ['AGB', 'Datenschutz', 'Impressum', 'AVV']) {
  mock.module(new URL(`src/pages/legal/${name}.jsx`, root).href, { exports: { default: () => React.createElement('p', null, name) } })
}
// Render the actual application route tree and guards, with services/pages isolated.
const App = (await import('../src/App.jsx')).default
let tree
let container
afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  container?.remove()
})

for (const [path, identity, page, destination = path] of [
  ['/dashboard', {}, 'Login', '/login'],
  ['/login', { isAuthenticated: true, operator: { onboarding_completed: true } }, 'Dashboard', '/dashboard'],
  ['/dashboard', { isAuthenticated: true, operator: { onboarding_completed: false } }, 'Onboarding', '/onboarding'],
  ['/kunde/dashboard', { isCustomerAuthenticated: true }, 'CustomerDashboard'],
  ['/kunde/profil', {}, 'CustomerLogin', '/kunde/login'],
  ['/admin/dashboard', { isAdminAuthenticated: true }, 'AdminDashboard'],
  ['/admin/dashboard', {}, 'AdminLogin', '/admin/login'],
  ['/park/fixture-park', {}, 'PublicBooking'],
  ['/embed/fixture-location', {}, 'BookingEmbed'],
  ['/datenschutz', {}, 'Datenschutz'],
  ['/unknown', {}, 'NotFound'],
]) {
  test(`actual route ${path} retains ${page} for the supplied identity`, async () => {
    session = identity
    window.history.replaceState({}, '', path)
    container = document.createElement('div')
    document.body.append(container)
    tree = createRoot(container)
    await act(async () => tree.render(React.createElement(App)))
    assert.equal(container.textContent, page)
    assert.equal(window.location.pathname, destination)
  })
}
