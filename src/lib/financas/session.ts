import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureFinanceSchema } from "@/lib/financas/migrate";

const COOKIE_NAME = "financas_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.FINANCAS_SECRET;
  if (!secret) {
    throw new Error(
      "Defina NEXTAUTH_SECRET (ou FINANCAS_SECRET) para assinar a sessão de finanças."
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Buffer {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64");
}

export type FinSessionPayload = {
  hid: string;
  iat: number;
  exp: number;
};

export function signSession(householdId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: FinSessionPayload = {
    hid: householdId,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  };
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): FinSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = base64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest()
  );
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(fromBase64url(body).toString("utf8")) as FinSessionPayload;
    if (!payload?.hid || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(householdId: string) {
  const token = signSession(householdId);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionFromCookies(): FinSessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySession(token);
}

export async function getCurrentHousehold() {
  const session = getSessionFromCookies();
  if (!session) return null;
  return prisma.household.findUnique({ where: { id: session.hid } });
}

export async function requireHousehold() {
  const household = await getCurrentHousehold();
  if (!household) {
    throw new HouseholdAuthError("Não autenticado");
  }
  return household;
}

export class HouseholdAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HouseholdAuthError";
  }
}

export async function householdExists(): Promise<boolean> {
  await ensureFinanceSchema();
  const count = await prisma.household.count();
  return count > 0;
}
