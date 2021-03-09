import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import typescript from '@rollup/plugin-typescript'

const pkg = require('./package')

const banner = (_ => {
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

const babelConfig = {
  exclude: 'node_modules/**',
  presets: [['@babel/env', { targets: { browsers: 'defaults' } }]],
}

export default {
  input: 'dexie-batch.ts',
  output: [
    // Browser-friendly UMD build
    outputConfig({
      file: pkg.main,
      name: 'DexieBatch',
      format: 'umd',
      globals: { dexie: 'Dexie' },
    }),
    // ECMAScript module build
    outputConfig({ file: pkg.module, format: 'es' }),
  ],
  external: ['dexie'],
  plugins: [typescript(), resolve(), commonjs(), babel(babelConfig)],
}
