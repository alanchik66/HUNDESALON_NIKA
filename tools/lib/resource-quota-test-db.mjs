/** Test-only D1 adapter executing the production quota migration in real SQLite. */
import { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const opened = new Set();
after(() => {
  for (const sqlite of opened) sqlite.close();
});

export function withResourceQuotaDatabase(database = {}, options = {}) {
  const sqlite = new DatabaseSync(options.path || ':memory:');
  opened.add(sqlite);
  sqlite.exec('PRAGMA busy_timeout = 10000;');
  if (options.migrated !== false) {
    sqlite.exec(readFileSync(new URL('../../migrations/0008_resource_usage_quotas.sql', import.meta.url), 'utf8'));
  }
  const originalPrepare = database.prepare?.bind(database);
  return {
    ...database,
    sqlite,
    prepare(sql) {
      if (!/resource_usage_/.test(sql) && originalPrepare) return originalPrepare(sql);
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async run() {
          return { meta: { changes: Number(statement.run(...values).changes) } };
        },
        async all() {
          return { results: statement.all(...values) };
        },
        async first() {
          return statement.get(...values) || null;
        },
      };
    },
  };
}
