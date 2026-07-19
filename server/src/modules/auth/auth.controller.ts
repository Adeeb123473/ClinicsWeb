import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as authService from "./auth.service.js";
import { registerClinic } from "./registration.service.js";
import type { RegisterClinicInput } from "./auth.schemas.js";
import { ApiError } from "../../utils/ApiError.js";

const REFRESH_COOKIE = "refreshToken";

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: env.jwt.refreshExpiryMs,
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  const result = await authService.login(username, password, req.ip ?? null);

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const result = await authService.refresh(token);

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: refreshCookieOptions.path });
  sendSuccess(res, null);
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerClinic(req.body as RegisterClinicInput);
  sendSuccess(res, result, 201);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const user = await authService.getProfile(req.authUser.sub);
  sendSuccess(res, { user });
});
