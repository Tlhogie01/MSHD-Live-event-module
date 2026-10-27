import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getPool } from "@backend/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const ADMIN_COOKIE = "mshd_admin";
export type AdminSession = { id: number; email: string; exp: number };

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.includes("generate-a-random-secret")) throw new Error("Set a private SESSION_SECRET with at least 32 random characters.");
  return secret;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(admin: Pick<AdminSession, "id" | "email">) {
  const payload = Buffer.from(JSON.stringify({ ...admin, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): AdminSession | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", sessionSecret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!Number.isSafeInteger(data.id) || !data.email || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

type AdminRow = RowDataPacket & { id: number; email: string; full_name: string; is_active: number };

export async function getCurrentAdmin(): Promise<(AdminSession & { fullName: string }) | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session) return null;
  const [rows] = await getPool().execute<AdminRow[]>("SELECT id,email,full_name,is_active FROM admins WHERE id=? LIMIT 1", [session.id]);
  const admin = rows[0];
  return admin?.is_active ? { ...session, fullName: admin.full_name } : null;
}
