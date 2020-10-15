#!/usr/bin/env node

const { runCoverage } = require('@openzeppelin/test-environment');

runCoverage(
  ['mocks', 'external'],
  './node_modules/.bin/oz compile',
  './node_modules/.bin/mocha --exit'.split(' '),
);
