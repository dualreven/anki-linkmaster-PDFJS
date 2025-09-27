// UTF-8, LF newlines
import { transformSync } from '@babel/core'
import cfg from '../babel.config.js'

const code = `
class A {
  #x = 1;
  getX = () => this?.#x ?? 0;
}
async function load() { const m = await import('./some/module.js'); return m?.default ?? null }
`

try {
  const result = transformSync(code, {
    ...cfg,
    filename: 'test.js',
    sourceMaps: false,
    ast: false,
    babelrc: false,
    configFile: false,
  })
  if (!result || typeof result.code !== 'string') {
    throw new Error('Babel transform returned no code')
  }
  console.log('[OK] Babel transform succeeded; length=' + result.code.length)
  process.exit(0)
} catch (e) {
  console.error('[ERROR] Babel transform failed')
  console.error(String(e && e.stack || e))
  process.exit(1)
}

