import { NextRequest, NextResponse } from "next/server";

const encoder = new TextEncoder();

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function validSession(token: string | undefined) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32 || secret.includes("generate-a-random-secret")) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), encoder.encode(payload));
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { id?: number; exp?: number };
    return Number.isSafeInteger(session.id) && typeof session.exp === "number" && session.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (await validSession(request.cookies.get("mshd_admin")?.value)) return NextResponse.next();
  const login = new URL("/admin/login", request.url);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*"] };
