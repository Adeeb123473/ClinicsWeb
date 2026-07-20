import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",

  db: {
    host: required("DB_HOST", "localhost"),
    port: parseInt(process.env.DB_PORT ?? "1433", 10),
    user: required("DB_USER", "sa"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME", "clinicos"),
    encrypt: (process.env.DB_ENCRYPT ?? "false") === "true",
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE ?? "true") === "true",
    // Local Docker dev connects as `sa` and can create the database itself. Hosted/managed SQL
    // Server (shared hosting, Azure SQL, etc.) provisions the database up front and the app's
    // login typically has no access to `master` at all — set this to "false" there.
    autoCreateDatabase: (process.env.DB_AUTO_CREATE_DATABASE ?? "true") === "true",
  },

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
    refreshExpiryMs: 7 * 24 * 60 * 60 * 1000,
  },

  seed: {
    superAdminUsername: process.env.SUPER_ADMIN_USERNAME ?? "superadmin",
    superAdminPassword: process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!",
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL ?? "superadmin@clinicos.local",
    demoUserPassword: process.env.DEMO_USER_PASSWORD ?? "Passw0rd!",
  },
};
