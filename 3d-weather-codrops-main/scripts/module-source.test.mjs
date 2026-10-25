import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renameModuleBindings } from './module-source.mjs';

test('recovery renames preserve public imports, exports, object keys, and nested scopes', () => {
  const input = 'import {x} from "vendor"; const value = {x}; function nested(x) { return x; } export {x};';
  const actual = renameModuleBindings(input, { x: 'readableName' });
  assert.match(actual, /import \{x as readableName\}/);
  assert.match(actual, /\{x: readableName\}/);
  assert.match(actual, /function nested\(x\) \{ return x; \}/);
  assert.match(actual, /export \{readableName as x\}/);
});

test('recovery rejects module binding collisions', () => {
  assert.throws(
    () => renameModuleBindings('const one = 1; const two = 2;', { one: 'two' }),
    /Module binding collision/
  );
});
