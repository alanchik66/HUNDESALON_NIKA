/* global module, require */
'use strict';

const { posix } = require('node:path');
const { Minimatch } = require('minimatch');

const MATCH_OPTIONS = new Set(['dot', 'nobrace', 'nocase', 'noextglob', 'noglobstar', 'posix', 'basename']);
const SCAN_OPTIONS = new Set(['parts']);
const RESERVED = new Set(['\\', '(', ')', '[', ']', '{', '}', '|']);

function unsupported(detail) {
  throw new TypeError(`Native glob matcher: unsupported ${detail}.`);
}

function readOptions(value, allowed) {
  if (value === undefined) return {};
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.getOwnPropertySymbols(value).length
  ) {
    unsupported('options object');
  }
  for (const [key, flag] of Object.entries(value)) {
    if (!allowed.has(key) || (flag !== undefined && typeof flag !== 'boolean')) unsupported(`option ${key}`);
  }
  if (value.posix === false) unsupported('non-POSIX pattern mode');
  return value;
}

// This is a bounded lexical contract, not a second glob parser. Matching belongs to Minimatch.
function inspectPattern(pattern) {
  if (typeof pattern !== 'string' || !pattern || pattern.length > 4096) unsupported('pattern value or length');
  for (const character of pattern) {
    if (RESERVED.has(character) || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) {
      unsupported('pattern syntax');
    }
  }
  const negated = pattern.startsWith('!');
  let positive = negated ? pattern.slice(1) : pattern;
  if (positive.startsWith('./')) positive = positive.slice(2);
  if (!positive || positive.startsWith('!') || positive.startsWith('./') || positive.includes('//')) {
    unsupported('pattern prefix or empty path segment');
  }
  const parts = positive.split('/');
  if (parts.length > 64 || parts.some(part => part.includes('**') && part !== '**')) {
    unsupported('embedded globstar or path depth');
  }
  return { positive, negated, parts };
}

function compile(pattern, options) {
  const { positive, negated } = inspectPattern(pattern);
  const engineOptions = {
    dot: options.dot === true,
    nocase: options.nocase === true,
    nobrace: options.nobrace === true,
    noext: options.noextglob === true,
    noglobstar: options.noglobstar === true,
    nonegate: true,
    nocomment: true,
    platform: 'linux',
  };
  const variants = [positive];
  // tinyglobby expands even file globs to P/**; its contract includes P itself.
  let base = positive;
  while (!options.noglobstar && base.endsWith('/**')) {
    base = base.slice(0, -3);
    if (base) variants.push(base);
  }
  const matchers = variants.map(value => new Minimatch(value, engineOptions));
  return input => {
    const candidate = options.basename ? posix.basename(input) : input;
    const matches = matchers.some(matcher => matcher.match(candidate));
    return negated ? !matches : matches;
  };
}

function nativeGlobMatcher(patterns, options) {
  if (arguments.length > 2) unsupported('factory argument');
  const settings = readOptions(options, MATCH_OPTIONS);
  const list = typeof patterns === 'string' ? [patterns] : patterns;
  if (!Array.isArray(list) || list.length > 64) unsupported('pattern list');
  const matchers = list.map(pattern => compile(pattern, settings));
  return function matches(input) {
    if (arguments.length > 1 || typeof input !== 'string') unsupported('matcher input');
    if (!input) return false;
    const candidate = input.replace(/\\/g, '/');
    return matchers.some(matcher => matcher(candidate));
  };
}

function isMatch(input, patterns, options) {
  if (arguments.length > 3) unsupported('isMatch argument');
  return nativeGlobMatcher(patterns, options)(input);
}

function scan(pattern, options) {
  if (arguments.length > 2) unsupported('scan argument');
  const settings = readOptions(options, SCAN_OPTIONS);
  const { positive, negated, parts } = inspectPattern(pattern);
  const result = { isGlob: positive.includes('*') || positive.includes('?'), negated };
  if (settings.parts) {
    if (!positive.includes('/')) result.parts = [];
    else if (positive.startsWith('/')) result.parts = [`/${parts[1]}`, ...parts.slice(2)];
    else result.parts = parts;
  }
  return result;
}

// One implementation serves both ESM default/named imports and tinyglobby's CJS build.
module.exports = nativeGlobMatcher;
module.exports.isMatch = isMatch;
module.exports.scan = scan;
