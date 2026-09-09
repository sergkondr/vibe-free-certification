'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateDeclaration } = require('../src/policy');

const markers = ['understood', 'tested', 'explain', 'no-ai', 'ai-reviewed'];
const core = markers.slice(0, 3);

function declaration(...checked) {
  return markers
    .map((marker) => `- [${checked.includes(marker) ? 'x' : ' '}] <!-- vibe-free:${marker} -->`)
    .join('\n');
}

function certify(...provenance) {
  return evaluateDeclaration(declaration(...core, ...provenance));
}

for (const [name, provenance, expected] of [
  ['grants both labels for a no-AI declaration', 'no-ai', ['certified-organic', true]],
  ['grants only no-vibecode for reviewed AI code', 'ai-reviewed', ['certified', false]],
]) {
  test(name, () => {
    const result = certify(provenance);
    assert.deepEqual([result.result, result.organic], expected);
    assert.equal(result.certified, true);
  });
}

test('rejects an incomplete core declaration', () => {
  const result = evaluateDeclaration(declaration('understood', 'explain', 'no-ai'));

  assert.equal(result.certified, false);
  assert.match(result.reasons.join(' '), /vibe-free:tested/);
});

test('rejects ambiguous provenance', () => {
  const result = certify('no-ai', 'ai-reviewed');

  assert.equal(result.certified, false);
  assert.match(result.reasons.join(' '), /only one/);
});

test('does not certify drafts', () => {
  const result = evaluateDeclaration(declaration(...core), { draft: true });

  assert.equal(result.result, 'draft');
});
