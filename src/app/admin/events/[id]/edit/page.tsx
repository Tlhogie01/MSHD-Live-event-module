"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogoutButton } from "@/app/admin/logout-button";

type Event = {
  title: string;
  description: string;
  venue: string;
  pass_type: "FREE" | "TICKETED";
  ticket_price: string | null;
  event_date: string;
  start_time: string;
  feature_photo_path: string | null;
};

const field = "mt-1 w-full rounded-xl border border-[#252e46] bg-[#090d16] px-3.5 py-3 text-sm text-white outline-none focus:border-[#f43f5e]";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [featureFile, setFeatureFile] = useState<File | null>(null);
  const [featurePreview, setFeaturePreview] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/events/${id}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load event.");
        if (active) setEvent(data.event);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load event."); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!featureFile) { setFeaturePreview(""); return; }
    const url = URL.createObjectURL(featureFile);
    setFeaturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [featureFile]);

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!event) return;
    setBusy(true);
    setError("");
    const form = new FormData(formEvent.currentTarget);
    const body = {
      title: form.get("title"),
      description: form.get("description"),
      venue: form.get("venue"),
      eventDate: form.get("eventDate"),
      startTime: form.get("startTime"),
      passType: form.get("passType"),
      ticketPrice: form.get("ticketPrice"),
    };

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? Object.values(result.errors ?? {}).join(" ") ?? "Could not save event.");

      if (featureFile) {
        const media = new FormData();
        media.set("mediaType", "PHOTO");
        media.set("setFeaturePhoto", "true");
        media.append("files", featureFile);
        const uploadResponse = await fetch(`/api/events/${id}/media`, { method: "POST", body: media });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(`Event details were saved, but the feature photo could not be updated. ${uploadResult.error ?? "Try a different image."}`);
      }

      router.push(`/admin/events/${id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save event.");
    } finally {
      setBusy(false);
    }
  }

  if (!event) return <main className="min-h-screen bg-[#090d16] p-8 text-white">{error || "Loading event…"}</main>;

  return <div className="min-h-screen bg-[#090d16] text-white md:flex">
    <aside className="bg-[#0d111d] p-6 md:w-64">
      <Link href="/admin/events" className="font-semibold">MSHD LIVE <span className="block text-xs text-[#94a3b8]">EVENTS ADMIN</span></Link>
      <nav className="mt-8 space-y-3 text-sm"><Link className="block text-white/70" href="/admin/events">All events</Link><LogoutButton /></nav>
    </aside>
    <main className="mx-auto w-full max-w-3xl p-5 py-10 md:p-10">
      <Link href={`/admin/events/${id}`} className="text-sm text-rose-400">← Event overview</Link>
      <h1 className="mt-5 text-3xl font-semibold">Edit event</h1>
      <p className="mt-2 text-sm text-[#94a3b8]">Update event information and choose the photo shown on event listings.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-950 p-4 text-sm text-rose-200">{error}</p>}
      <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-[#1b2234] bg-[#0e1220] p-5">
        <label className="block text-sm">Title<input name="title" defaultValue={event.title} required maxLength={180} className={field} /></label>
        <label className="block text-sm">Description<textarea name="description" defaultValue={event.description} required rows={5} className={field} /></label>

        <section>
          <label htmlFor="featurePhoto" className="block text-sm font-medium">Featured photo</label>
          <p className="mt-1 text-xs text-[#94a3b8]">This image appears on the event listing and at the top of the event page. Choose a new image to replace the current one.</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#252e46] bg-[#090d16]">
            {featurePreview || event.feature_photo_path ? <Image src={featurePreview || event.feature_photo_path!} alt="Featured photo preview" width={1200} height={600} unoptimized={Boolean(featurePreview)} className="aspect-[2/1] w-full object-cover" /> : <div className="grid aspect-[2/1] place-items-center text-sm text-[#64748b]">No featured photo uploaded</div>}
          </div>
          <input id="featurePhoto" name="featurePhoto" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFeatureFile(e.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm text-[#cbd5e1] file:mr-3 file:rounded-lg file:border-0 file:bg-[#801b38] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
          <p className="mt-1 text-xs text-[#64748b]">PNG, JPG or WebP, up to 10 MB.</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Date<input name="eventDate" type="date" defaultValue={event.event_date} required className={field} /></label>
          <label className="text-sm">Start time<input name="startTime" type="time" defaultValue={event.start_time} required className={field} /></label>
        </div>
        <label className="block text-sm">Venue<input name="venue" defaultValue={event.venue} required className={field} /></label>
        <label className="block text-sm">Entrance type<select name="passType" defaultValue={event.pass_type} className={field}><option value="FREE">Free entrance</option><option value="TICKETED">Ticketed</option></select></label>
        <label className="block text-sm">Starting ticket price (ZAR)<input name="ticketPrice" type="number" min="0.01" step="0.01" defaultValue={event.ticket_price ?? ""} className={field} /><small className="text-[#64748b]">For ticketed events. Ticket type prices are managed separately.</small></label>
        <button disabled={busy} className="rounded-xl bg-[#801b38] px-5 py-3 text-sm font-semibold disabled:opacity-60">{busy ? "Saving…" : "Save changes"}</button>
      </form>
    </main>
  </div>;
}
