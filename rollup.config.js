import typescript from '@rollup/plugin-typescript'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'

const pkg = require('./package')

const banner = (() => {
  const id = `${pkg.name} v${pkg.version}`
  const homepage = 'github.com/' + pkg.repository
  const license = `${pkg.license} License`
  return `/*! ${id} | ${homepage} | ${license} */`
})()

function outputConfig(config) {
  return { sourcemap: true, banner, ...config }
}

function umdConfig(config) {
  return outputConfig({
    format: 'umd',
    name: 'DexieBatch',
    globals: { dexie: 'Dexie' },
    ...config,
  })
}

const babelConfig = {
  extensions: ['.js', '.ts'],
  babelHelpers: 'bundled',
  exclude: 'node_modules/**',
  presets: [['@babel/env', { targets: { browsers: 'defaults' } }]],
}

const tsOptions = {
  module: 'ESNext',
  exclude: 'test/**',
}

export default {
  input: 'dexie-batch.ts',
  output: [
    // Browser-friendly UMD build
    // We need to use `dir` so declaration files are generated
    umdConfig({ dir: 'dist' }),
    umdConfig({
      file: pkg.main.replace(/\.js$/, '.min.js'),
      plugins: [terser()],
    }),
    // ECMAScript module build
    outputConfig({ file: pkg.module, format: 'es' }),
  ],
  external: ['dexie'],
  plugins: [typescript(tsOptions), babel(babelConfig)],
}
