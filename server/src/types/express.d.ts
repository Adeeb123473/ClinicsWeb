import type { AccessTokenPayload } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Populated by the `authenticate` middleware from a verified access token. */
      authUser?: AccessTokenPayload;
      /** Populated by the `validateQuery` middleware with the parsed query object. */
      validatedQuery?: unknown;
    }
  }
}

export {};
