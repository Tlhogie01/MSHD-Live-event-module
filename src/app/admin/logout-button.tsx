"use client";
import { useRouter } from "next/navigation";
export function LogoutButton(){
  const router=useRouter();
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/admin/login");router.refresh();}
  return <button onClick={logout} className="mt-3 w-full rounded-lg px-4 py-3 text-left text-sm text-white/65 hover:bg-white/10">↪　Sign out</button>;
}
