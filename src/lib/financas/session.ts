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
  /** user id — null/missing em sessões legacy que eram só Household */
  uid?: string;
  /** household id — sempre presente. Em sessões legacy era o único dado */
  hid: string;
  iat: number;
  exp: number;
};

export function signSession(opts: { userId?: string | null; householdId: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: FinSessionPayload = {
    uid: opts.userId ?? undefined,
    hid: opts.householdId,
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

export async function setSessionCookie(opts: { userId?: string | null; householdId: string }) {
  const token = signSession(opts);
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

export async function getCurrentUser() {
  const session = getSessionFromCookies();
  if (!session?.uid) return null;
  return prisma.user.findUnique({
    where: { id: session.uid },
    include: {
      memberships: {
        include: { household: true },
      },
    },
  });
}

export async function requireHousehold() {
  const household = await getCurrentHousehold();
  if (!household) {
    throw new HouseholdAuthError("Não autenticado");
  }
  return household;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HouseholdAuthError("Não autenticado");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new HouseholdAuthError("Não autenticado");
  if (!user.isAdmin) throw new HouseholdAuthError("Acesso restrito a administradores");
  return user;
}

/** Retorna a lista de emails admin configurados via env ARTHEA_ADMIN_EMAILS. */
export function getAdminEmails(): string[] {
  const raw = process.env.ARTHEA_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase().trim());
}

const IMPERSONATE_COOKIE = "financas_admin_session";

/** Guarda a sessão original do admin antes de impersonar */
export async function setImpersonationOriginCookie(originalToken: string) {
  cookies().set(IMPERSONATE_COOKIE, originalToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 horas
  });
}

export function getImpersonationOriginToken(): string | null {
  return cookies().get(IMPERSONATE_COOKIE)?.value || null;
}

export async function clearImpersonationOriginCookie() {
  cookies().set(IMPERSONATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
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
