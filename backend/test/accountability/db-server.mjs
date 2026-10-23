import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// An in-memory Postgres with the real migrations applied.
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '../../prisma/migrations');
const db = await PGlite.create();
for (const m of fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort()) {
  await db.exec(fs.readFileSync(path.join(dir, m, 'migration.sql'), 'utf8'));
}
await new PGLiteSocketServer({ db, port: 5544, host: '127.0.0.1', maxConnections: 20 }).start();
console.log('DB READY on 5544');
