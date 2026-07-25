const originalWarn = console.warn;

console.warn = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('[csstree-match] BREAK after 15000 iterations')) {
    return;
  }
  originalWarn.apply(console, args);
};

import stylelint from 'stylelint';

const files = process.argv.slice(2);

if (!files.length) {
  originalWarn('No files specified for stylelint');
  process.exit(1);
}

const result = await stylelint.lint({ files });
const formatter = await stylelint.formatters['string'];
const output = formatter(result.results, result);

process.stdout.write(output);

process.exit(result.errored ? 1 : 0);
