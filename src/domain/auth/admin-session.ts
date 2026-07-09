import { webcrypto } from "node:crypto";

import type { Context } from "hono";

import type { AppConfig } from "../../shared/config/app-config";

const SESSION_COOKIE_NAME = "nimrodi_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  version: 1;
  authenticated: true;
  expiresAt: number;
}

function toBase64Url(input: Uint8Array) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

async function signValue(value: string, secret: string) {
  const encoder = new TextEncoder();
  const cryptoApi = globalThis.crypto ?? webcrypto;
  const key = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await cryptoApi.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );
  return toBase64Url(new Uint8Array(signature));
}

function readCookieValue(cookieHeader: string | undefined, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === cookieName) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

function buildCookieOptions(config: AppConfig) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (config.appEnv === "production") {
    cookieParts.push("Secure");
  }

  return cookieParts;
}

export async function createAdminSessionValue(config: AppConfig) {
  const payload: SessionPayload = {
    version: 1,
    authenticated: true,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  };
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await signValue(encodedPayload, config.sessionSecret);

  return `${encodedPayload}.${signature}`;
}

export async function setAdminSessionCookie(
  c: Context<{ Bindings: Env }>,
  config: AppConfig
) {
  const value = await createAdminSessionValue(config);
  const cookie = buildCookieOptions(config);
  cookie[0] = `${SESSION_COOKIE_NAME}=${value}`;
  c.header("Set-Cookie", cookie.join("; "), { append: true });
}

export function clearAdminSessionCookie(
  c: Context<{ Bindings: Env }>,
  config: AppConfig
) {
  const cookie = buildCookieOptions(config);
  cookie[0] = `${SESSION_COOKIE_NAME}=`;
  cookie.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  cookie.push("Max-Age=0");
  c.header("Set-Cookie", cookie.join("; "), { append: true });
}

export async function isAdminSessionAuthenticated(
  c: Context<{ Bindings: Env }>,
  config: AppConfig
) {
  const rawCookie = readCookieValue(
    c.req.header("cookie"),
    SESSION_COOKIE_NAME
  );

  if (!rawCookie) {
    return false;
  }

  const [encodedPayload, providedSignature] = rawCookie.split(".");
  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = await signValue(
    encodedPayload,
    config.sessionSecret
  );
  if (providedSignature !== expectedSignature) {
    return false;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload))
    ) as SessionPayload;

    return (
      payload.version === 1 &&
      payload.authenticated === true &&
      Number.isFinite(payload.expiresAt) &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
