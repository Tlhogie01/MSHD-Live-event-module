import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "@backend/lib/db";

export async function GET() {
  try {
    const [events] = await getPool().execute<RowDataPacket[]>("SELECT e.id,e.title,e.description,e.pass_type,e.ticket_price,e.event_logo_path,e.feature_photo_path,DATE_FORMAT(e.event_date,'%Y-%m-%d') AS event_date,TIME_FORMAT(e.start_time,'%H:%i') AS start_time,e.venue,(SELECT COUNT(*) FROM event_media m WHERE m.event_id=e.id AND m.media_type='PHOTO' AND m.deleted_at IS NULL AND (e.feature_photo_path IS NULL OR m.file_path<>e.feature_photo_path)) AS photo_count,(SELECT COUNT(*) FROM event_media m WHERE m.event_id=e.id AND m.media_type='VIDEO' AND m.deleted_at IS NULL) AS video_count FROM events e WHERE e.status IN ('PUBLISHED','COMPLETED') AND e.deleted_at IS NULL ORDER BY e.event_date ASC,e.start_time ASC");
    return NextResponse.json({events});
  } catch (error) {
    console.error("Could not list public events", error);
    return NextResponse.json({error:"Events are temporarily unavailable."},{status:503});
  }
}
