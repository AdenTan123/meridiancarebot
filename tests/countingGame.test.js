import test from 'node:test';
import assert from 'node:assert/strict';

import { validateCountingAttempt } from '../src/services/countingGameService.js';

test('validateCountingAttempt correctly parses decimal numbers', () => {
  const config = {
    system: 'decimal',
    nextNumber: 5,
    mathExpressions: false,
  };

  assert.equal(validateCountingAttempt('5', config), 'number');
  assert.equal(validateCountingAttempt('6', config), 'invalid');
  assert.equal(validateCountingAttempt('hello', config), null);
});

test('validateCountingAttempt correctly parses math expressions', () => {
  const config = {
    system: 'decimal',
    nextNumber: 5,
    mathExpressions: true,
  };

  assert.equal(validateCountingAttempt('2 + 3', config), 'math');
  assert.equal(validateCountingAttempt('2 + 3 = 5', config), 'math');
  assert.equal(validateCountingAttempt('2 + 4', config), 'invalid');
  assert.equal(validateCountingAttempt('2 + 4 = 6', config), 'invalid');
  assert.equal(validateCountingAttempt('hello', config), null);
});

test('validateCountingAttempt correctly parses hex numbers', () => {
  const config = {
    system: 'hexadecimal',
    nextNumber: 10,
    mathExpressions: false,
  };

  assert.equal(validateCountingAttempt('a', config), 'number');
  assert.equal(validateCountingAttempt('A', config), 'number');
  assert.equal(validateCountingAttempt('B', config), 'invalid');
  assert.equal(validateCountingAttempt('g', config), null);
});

test('validateCountingAttempt correctly parses roman numerals', () => {
  const config = {
    system: 'roman',
    nextNumber: 4,
    mathExpressions: false,
  };

  assert.equal(validateCountingAttempt('iv', config), 'number');
  assert.equal(validateCountingAttempt('IV', config), 'number');
  assert.equal(validateCountingAttempt('V', config), 'invalid');
  assert.equal(validateCountingAttempt('hello', config), null);
});

test('validateCountingAttempt correctly parses alphabet sequencing', () => {
  const config = {
    system: 'alphabet',
    nextNumber: 27,
    mathExpressions: false,
  };

  assert.equal(validateCountingAttempt('AA', config), 'number');
  assert.equal(validateCountingAttempt('aa', config), 'number');
  assert.equal(validateCountingAttempt('AB', config), 'invalid');
});
