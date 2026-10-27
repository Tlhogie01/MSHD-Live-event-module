"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type EventSummary = {
  id: number;
  title: string;
  description: string;
  pass_type: "FREE" | "TICKETED";
  ticket_price: string | null;
  event_logo_path: string | null;
  feature_photo_path: string | null;
  event_date: string;
  start_time: string;
  venue: string;
  photo_count: number;
  video_count: number;
};

const money = (amount: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(`${date}T12:00:00`));

export default function EventsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/public/events")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load events.");
        if (active) setEvents(data.events ?? []);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load events."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
  const upcomingEvents = events.filter(event => event.event_date >= today);
  const pastEvents = events.filter(event => event.event_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date));

  function eventCards(items: EventSummary[]) {
    return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(event => (
      <Link key={event.id} href={`/events/${event.id}`} className="group overflow-hidden rounded-2xl border border-[#1b2234] bg-[#0e1220] transition hover:-translate-y-0.5 hover:border-[#801b38] hover:shadow-xl hover:shadow-black/20">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#151b2e]">
          {event.feature_photo_path ? <Image src={event.feature_photo_path} alt={event.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center text-4xl font-semibold text-[#f43f5e]">{event.title.slice(0, 1)}</div>}
          {event.event_logo_path && <Image src={event.event_logo_path} alt="" width={52} height={52} className="absolute bottom-3 left-3 h-12 w-12 rounded-xl border border-white/20 bg-white object-contain p-1 shadow-lg" />}
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#f43f5e]">{dateLabel(event.event_date)} · {event.start_time}</p>
          <h3 className="mt-2 text-xl font-semibold leading-snug">{event.title}</h3>
          <p className="mt-1 text-sm text-[#94a3b8]">{event.venue}</p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#cbd5e1]">{event.description}</p>
          {(event.photo_count > 0 || event.video_count > 0) && <p className="mt-3 text-xs text-[#94a3b8]">{event.photo_count} photos · {event.video_count} videos</p>}
          <div className="mt-5 flex items-center justify-between border-t border-[#1b2234] pt-4 text-sm">
            <span className="text-[#cbd5e1]">{event.pass_type === "FREE" ? "Free entrance" : `Tickets from ${money(Number(event.ticket_price ?? 0))}`}</span>
            <span className="font-medium text-[#f43f5e]">View event <span aria-hidden="true">→</span></span>
          </div>
        </div>
      </Link>
    ))}</div>;
  }

  return (
    <main className="min-h-screen bg-[#090d16] px-5 py-10 text-white md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/events" className="flex items-center gap-3" aria-label="MSHD Live events home">
            <Image src="/mshd-live-logo.png" alt="MSHD Live" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
            <span><strong className="block tracking-wide">MSHD LIVE</strong><small className="text-xs text-[#94a3b8]">EVENTS</small></span>
          </Link>
          <Link href="/admin/login" className="rounded-xl border border-[#252e46] px-4 py-2.5 text-sm font-medium text-[#cbd5e1] transition hover:border-[#801b38] hover:text-white">Admin sign in</Link>
        </header>

        <section className="mt-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#f43f5e]">Live experiences · Community · Culture</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">MSHD Live events</h1>
          <p className="mt-4 text-base leading-7 text-[#94a3b8]">Find your next experience, or revisit a past event to view its photos and videos.</p>
        </section>

        {error && <div role="alert" className="mt-8 rounded-2xl border border-rose-900/70 bg-rose-950/40 p-5 text-sm text-rose-200">{error}</div>}
        {loading && <p className="mt-10 text-sm text-[#94a3b8]">Loading events…</p>}
        {!loading && !error && events.length === 0 && <p className="mt-10 rounded-2xl border border-[#1b2234] bg-[#0e1220] p-6 text-sm text-[#94a3b8]">No events are published right now. Check back soon.</p>}

        {!loading && !error && upcomingEvents.length > 0 && <section className="mt-9"><h2 className="mb-4 text-2xl font-semibold">Upcoming</h2>{eventCards(upcomingEvents)}</section>}
        {!loading && !error && pastEvents.length > 0 && <section className="mt-12"><h2 className="text-2xl font-semibold">Past events</h2><p className="mb-4 mt-2 text-sm text-[#94a3b8]">Visit an event page to browse its photo and video gallery.</p>{eventCards(pastEvents)}</section>}
        <footer className="mt-16 border-t border-[#1b2234] py-6 text-xs text-[#64748b]">© MSHD Live · Event information and ticket sales</footer>
      </div>
    </main>
  );
}
