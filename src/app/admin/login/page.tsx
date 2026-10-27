"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Sign-in failed."); return; }
      router.replace("/admin/events"); router.refresh();
    } catch { setError("Could not reach the app. Try again."); }
    finally { setBusy(false); }
  }
  return <main className="relative grid min-h-screen place-items-center bg-[#090d16] px-5 py-10 text-white"><Link href="/events" className="absolute left-5 top-5 rounded-lg border border-[#252e46] px-3 py-2 text-sm text-rose-400 hover:bg-[#151b2e]">← Back to events</Link><div className="w-full max-w-md rounded-3xl border border-[#1b2234] bg-[#0e1220] p-8 shadow-2xl"><div className="mb-8 flex items-center gap-3"><Image src="/mshd-live-logo.png" alt="MSHD Live logo" width={48} height={48} className="rounded-full"/><div><p className="font-semibold">MSHD LIVE</p><p className="text-xs text-[#94a3b8]">ADMINISTRATION</p></div></div><h1 className="text-2xl font-semibold">Administrator sign in</h1><p className="mt-2 text-sm text-[#94a3b8]">Sign in to manage events, tickets, and media.</p><form onSubmit={submit} className="mt-7 space-y-5"><div><label htmlFor="email" className="text-sm font-medium">Email address</label><input id="email" name="email" type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border border-[#252e46] bg-[#090d16] px-4 py-3 text-sm outline-none focus:border-[#f43f5e]"/></div><div><label htmlFor="password" className="text-sm font-medium">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-[#252e46] bg-[#090d16] px-4 py-3 text-sm outline-none focus:border-[#f43f5e]"/></div>{error&&<p role="alert" className="rounded-lg bg-rose-950/70 p-3 text-sm text-rose-200">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#801b38] px-4 py-3 text-sm font-semibold disabled:opacity-60">{busy?"Signing in…":"Sign in"}</button></form></div></main>;
}
