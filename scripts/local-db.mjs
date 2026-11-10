// Runs a private PostgreSQL 17 for local development — no Docker or installer needed.
// Data lives in ./.pgdata. Usage: `npm run db:local` (keep it running in its own terminal).
import EmbeddedPostgres from "embedded-postgres";
import fs from "fs";
import path from "path";

const dir = path.resolve(".pgdata");
const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "app",
  password: "app",
  port: 5433,
  persistent: true,
  // UTF-8 everywhere (Windows would otherwise default to WIN1252 and reject characters like ₹).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (fresh) await pg.initialise();
await pg.start();
for (const name of ["furniture", "furniture_test"]) {
  try {
    await pg.createDatabase(name);
  } catch {
    /* already exists */
  }
}
console.log("PostgreSQL is running on port 5433 (databases: furniture, furniture_test). Press Ctrl+C to stop.");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
