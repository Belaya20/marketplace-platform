// src/config/jwt.ts
// Req 3.1.2: Secure login, Remember me option
// Req 4.2: Secure password hashing, HTTPS encryption

import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const ACCESS_SECRET  = process.env.JWT_SECRET         || 'change-in-production-access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-in-production-refresh';

export interface JwtPayload {
  userId:   string;
  email:    string;
  role:     'guest' | 'customer' | 'seller' | 'admin';
  sellerId?: string;
  jti:      string;
}

// Convert env durations to seconds safely
function parseDuration(value: string | undefined, fallbackSeconds: number): number {
  if (!value) return fallbackSeconds;

  // If it's a number string, return it directly
  if (/^\d+$/.test(value)) return Number(value);

  // If it's like "15m", "7d", etc.
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return amount;
    case 'm': return amount * 60;
    case 'h': return amount * 3600;
    case 'd': return amount * 86400;
    default:  return fallbackSeconds;
  }
}

// Req 3.1.2: Short-lived access token (15 min)
export function signAccessToken(payload: Omit<JwtPayload, 'jti'>): string {
  const expiresInSeconds = parseDuration(process.env.JWT_EXPIRES_IN, 15 * 60);

  const options: SignOptions = { expiresIn: expiresInSeconds };

  return jwt.sign(
    { ...payload, jti: uuidv4() },
    ACCESS_SECRET,
    options
  );
}

// Req 3.1.2: Remember me — refresh token (7d or 30d)
export function signRefreshToken(
  payload: Omit<JwtPayload, 'jti'>,
  rememberMe = false
): string {
  const expiresInSeconds = rememberMe
    ? 30 * 24 * 60 * 60
    : parseDuration(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60);

  const options: SignOptions = { expiresIn: expiresInSeconds };

  return jwt.sign(
    { ...payload, jti: uuidv4() },
    REFRESH_SECRET,
    options
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
