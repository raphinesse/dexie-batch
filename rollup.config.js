import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
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
  const defaultConfig = {
    sourcemap: true,
    banner,
  }
  return Object.assign(defaultConfig, config)
}

function umdConfig(config) {
  const defaultConfig = {
    name: 'DexieBatch',
    format: 'umd',
    globals: { dexie: 'Dexie' },
  }
  return outputConfig(Object.assign(defaultConfig, config))
}

const babelConfig = {
  babelHelpers: 'bundled',
  exclude: 'node_modules/**',
  presets: [['@babel/env', { targets: { browsers: 'defaults' } }]],
}

export default {
  input: 'dexie-batch.js',
  output: [
    // Browser-friendly UMD build
    umdConfig({ file: pkg.main }),
    umdConfig({
      file: pkg.main.replace(/\.js$/, '.min.js'),
      plugins: [terser()],
    }),
    // ECMAScript module build
    outputConfig({ file: pkg.module, format: 'es' }),
  ],
  external: ['dexie'],
  plugins: [resolve(), commonjs(), babel(babelConfig)],
}
