import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { getPool } from "./config/db.js";

async function main() {
  await getPool();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`ClinicOS API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
