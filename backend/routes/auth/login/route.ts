import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { ADMIN_COOKIE, createSessionToken, verifyPassword } from "@backend/lib/auth";
import { getPool } from "@backend/lib/db";

type AdminRow = RowDataPacket & { id: number; email: string; password_hash: string; full_name: string; is_active: number };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const [rows] = await getPool().execute<AdminRow[]>("SELECT id,email,password_hash,full_name,is_active FROM admins WHERE email=? LIMIT 1", [email]);
    const admin = rows[0];
    if (!admin || !admin.is_active || !verifyPassword(password, admin.password_hash)) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const response = NextResponse.json({ id: admin.id, fullName: admin.full_name });
    response.cookies.set(ADMIN_COOKIE, createSessionToken({ id: admin.id, email: admin.email }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Admin login failed", error);
    const detail = error as { code?: string; message?: string };
    if (detail.message?.includes("SESSION_SECRET")) {
      return NextResponse.json({ error: "SESSION_SECRET is missing, too short, or still the example placeholder. Set a private value of at least 32 characters, then restart the app." }, { status: 503 });
    }
    if (detail.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ error: "The admins table is missing. Run backend/database/migrations/003_create_admins.sql, then restart the app." }, { status: 503 });
    }
    return NextResponse.json({ error: "Admin sign-in is not ready. Check the database migration and SESSION_SECRET configuration." }, { status: 503 });
  }
}
