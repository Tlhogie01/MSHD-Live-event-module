"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Event = {
  id: number; title: string; description: string; pass_type: "FREE" | "TICKETED";
  ticket_price: string | null; event_logo_path: string | null; feature_photo_path: string | null;
  event_date: string; start_time: string; venue: string;
};
type Media = { id: number; media_type: "PHOTO" | "VIDEO"; file_name: string; file_path: string };
type Ticket = { id: number; name: string; description: string; price: string; available_quantity: number };
type EventResponse = { event: Event; media: Media[]; tickets: Ticket[] };

const money = (amount: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
const fieldClass = "mt-2 w-full rounded-xl border border-[#252e46] bg-[#090d16] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#f43f5e]";

export default function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/events/${id}`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load this event.");
        if (active) setData(result);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load this event."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function buyTickets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setPurchaseError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/tickets/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: data.event.id, ticketId: form.get("ticketId"), quantity: Number(form.get("quantity")), customerName: form.get("customerName"), customerEmail: form.get("customerEmail") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not start checkout.");
      const gatewayForm = document.createElement("form");
      gatewayForm.method = "POST";
      gatewayForm.action = result.gateway;
      for (const [name, value] of Object.entries(result.fields as Record<string, string>)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        gatewayForm.appendChild(input);
      }
      document.body.appendChild(gatewayForm);
      gatewayForm.submit();
    } catch (reason) {
      setPurchaseError(reason instanceof Error ? reason.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[#090d16] px-5 py-10 text-white"><div className="mx-auto max-w-6xl text-sm text-[#94a3b8]">Loading event…</div></main>;
  if (error || !data) return <main className="min-h-screen bg-[#090d16] px-5 py-10 text-white"><div className="mx-auto max-w-6xl"><Link href="/events" className="text-sm text-[#f43f5e]">← All events</Link><p role="alert" className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200">{error || "This event is not available."}</p></div></main>;

  const { event: item, media, tickets } = data;
  return (
    <main className="min-h-screen bg-[#090d16] px-5 py-8 text-white md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/events" className="flex items-center gap-3"><Image src="/mshd-live-logo.png" alt="MSHD Live" width={42} height={42} className="h-10 w-10 rounded-full object-cover" /><span className="font-semibold tracking-wide">MSHD LIVE</span></Link>
          <Link href="/events" className="rounded-lg border border-[#252e46] px-3 py-2 text-sm text-[#f43f5e] hover:bg-[#151b2e]">← All events</Link>
        </header>
        {item.feature_photo_path ? <Image src={item.feature_photo_path} alt={item.title} width={1600} height={800} priority className="mt-7 aspect-[2/1] w-full rounded-2xl border border-[#1b2234] object-cover" /> : <div className="mt-7 aspect-[2/1] rounded-2xl bg-[#151b2e]" />}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article>
            {item.event_logo_path && <Image src={item.event_logo_path} alt="Event logo" width={80} height={80} className="mb-4 h-20 w-20 rounded-xl bg-white object-contain p-2" />}
            <p className="text-sm font-medium text-[#f43f5e]">{new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(`${item.event_date}T12:00:00`))} · {item.start_time} · {item.venue}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
            <div className="mt-5 inline-flex rounded-full bg-[#151b2e] px-3 py-1.5 text-sm text-[#cbd5e1]">{item.pass_type === "FREE" ? "Free entrance" : "Ticketed event"}</div>
            <section className="mt-7"><h2 className="text-xl font-semibold">About this event</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-[#cbd5e1]">{item.description}</p></section>
            <section className="mt-9"><h2 className="text-xl font-semibold">Photos and videos</h2>
              {media.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{media.map(file => file.media_type === "PHOTO" ? <Image key={file.id} src={file.file_path} alt={file.file_name} width={700} height={500} className="aspect-video w-full rounded-xl object-cover" /> : <video key={file.id} src={file.file_path} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />)}</div> : <p className="mt-3 text-sm text-[#94a3b8]">No additional media yet.</p>}
            </section>
          </article>

          {item.pass_type === "TICKETED" && <aside className="h-fit rounded-2xl border border-[#1b2234] bg-[#0e1220] p-5 lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">Purchase tickets</h2>
            {tickets.length ? <form onSubmit={buyTickets} className="mt-4 space-y-4">
              <label className="block text-sm">Ticket type<select name="ticketId" required className={fieldClass}>{tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{ticket.name} · {money(Number(ticket.price))} ({ticket.available_quantity} available)</option>)}</select></label>
              <label className="block text-sm">Your name<input name="customerName" autoComplete="name" required maxLength={180} className={fieldClass} /></label>
              <label className="block text-sm">Email address<input name="customerEmail" type="email" autoComplete="email" required maxLength={254} className={fieldClass} /></label>
              <label className="block text-sm">Quantity<input name="quantity" type="number" min="1" max="10" defaultValue="1" required className={fieldClass} /></label>
              {purchaseError && <p role="alert" className="rounded-lg bg-rose-950/70 p-3 text-sm text-rose-200">{purchaseError}</p>}
              <button disabled={busy} className="w-full rounded-xl bg-[#801b38] px-4 py-3 text-sm font-semibold transition hover:bg-[#9d2246] disabled:opacity-60">{busy ? "Connecting to PayFast…" : "Continue to PayFast"}</button>
              <p className="text-xs leading-5 text-[#64748b]">Payment is processed by PayFast. Your tickets are issued after payment is confirmed.</p>
            </form> : <p className="mt-3 text-sm text-[#94a3b8]">Tickets are not currently available.</p>}
          </aside>}
        </div>
      </div>
    </main>
  );
}
