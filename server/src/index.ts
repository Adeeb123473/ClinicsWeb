import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { getPool } from "./config/db.js";
import { runMigrations } from "./db/migrate.js";

async function main() {
  await getPool();
  // Idempotent — only applies migrations not yet recorded, so this is safe to run on every
  // boot. That makes a fresh deploy against an already-provisioned (but empty) hosted database
  // self-sufficient: no separate migration step needed on platforms without shell access.
  const applied = await runMigrations();
  if (applied > 0) console.log(`Applied ${applied} migration(s).`);

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`ClinicOS API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
