#!/usr/bin/env node

const { writeFileSync } = require('fs');
const { join } = require('path');

const ourPackage = require(join(process.cwd(), 'package.json'));

const isProduction = process.env.NODE_ENV?.toLowerCase() === 'production';

const external = new Set(['@google-cloud/*', 'express', 'react', 'react-dom']);

// Choose only the dependencies that are external
const dependencies = Object.keys(ourPackage.dependencies).reduce((memo, key) => {
  if (external.has(key) || key.startsWith('@google-cloud/')) {
    memo[key] = ourPackage.dependencies[key];
  }
  return memo;
}, {});

const buildPackage = {
  name: ourPackage.name,
  engines: {
    node: '>=16',
  },
  main: 'index.js',
  dependencies,
  private: true,
  packageManager: 'npm@8.3.1',
  scripts: {
    postinstall: ourPackage.scripts.postinstall,
  },
};

require('esbuild')
  .build({
    entryPoints: ['deploy-src/index.js'],
    outdir: './dist',
    bundle: true,
    target: ['node16'],
    platform: 'node',
    minify: true,
    treeShaking: true,
    sourcemap: isProduction ? false : true,
    external: Array.from(external),
  })
  .then(() => writeFileSync('dist/package.json', JSON.stringify(buildPackage)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => {
    console.log('esbuild success');
  });
