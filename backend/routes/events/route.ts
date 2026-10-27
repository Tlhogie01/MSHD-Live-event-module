import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "@backend/lib/db";
import { getCurrentAdmin } from "@backend/lib/auth";
export const runtime = "nodejs";
type EventRow = RowDataPacket & { id:number; title:string; description:string; pass_type:"FREE"|"TICKETED"; ticket_price:string|null; event_logo_path:string|null; event_date:string; start_time:string; venue:string; status:string; photo_count:number; video_count:number };

function databaseErrorHint(error: unknown): string {
  const value = error as { code?: string; message?: string };
  switch (value?.code) {
    case "ER_ACCESS_DENIED_ERROR": return "MySQL rejected the login. Check DB_USER, DB_PASSWORD, and that the MySQL user is allowed to connect from 127.0.0.1.";
    case "ECONNREFUSED": return "The app could not reach MySQL at the configured host and port. Check DB_HOST, DB_PORT, and that MySQL is listening.";
    case "ER_BAD_DB_ERROR": return "The configured database does not exist. Run backend/database/schema.sql in MySQL Workbench.";
    case "ER_NO_SUCH_TABLE": return "The database is reachable, but its tables are missing. Run backend/database/schema.sql in MySQL Workbench.";
    case "ER_BAD_FIELD_ERROR":
      if(value.message?.includes("event_logo_path")) return "The database needs the event-logo update. Run backend/database/migrations/002_add_event_logo_to_events.sql in MySQL Workbench.";
      if(value.message?.includes("feature_photo_path")) return "The feature-photo column is missing. Run backend/database/schema.sql for a new database or update the events table to include feature_photo_path.";
      return "The database needs the ticket-price update. Run backend/database/migrations/001_add_ticket_price_to_events.sql in MySQL Workbench.";
    default:
      if (value?.message?.startsWith("Database is not configured")) return "The app has no database settings. Set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in .env.local, then restart Next.js.";
      return "MySQL returned an error. Check the server log for its error code.";
  }
}

export async function GET(request:Request) {
  try {
    const admin=await getCurrentAdmin();
    if(!admin)return NextResponse.json({error:"Administrator sign-in required."},{status:401});
    const {searchParams}=new URL(request.url), status=searchParams.get("status"), q=searchParams.get("q")?.trim();
    const page=Math.max(1,Number(searchParams.get("page")??1)), limit=Math.min(50,Math.max(1,Number(searchParams.get("limit")??12)));
    const conditions=["e.deleted_at IS NULL"], params:(string|number)[]=[];
    if (["DRAFT","PUBLISHED","UNPUBLISHED","CANCELLED","COMPLETED"].includes(status??"")) { conditions.push("e.status = ?"); params.push(status!); }
    if(q){conditions.push("(e.title LIKE ? OR e.venue LIKE ?)");params.push(`%${q}%`,`%${q}%`);}
    const where=conditions.join(" AND "), pool=getPool();
    const [counts]=await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM events e WHERE ${where}`,params);
    const [rows]=await pool.execute<EventRow[]>(`SELECT e.id,e.title,e.description,e.pass_type,e.ticket_price,e.event_logo_path,DATE_FORMAT(e.event_date,'%Y-%m-%d') AS event_date,TIME_FORMAT(e.start_time,'%H:%i') AS start_time,e.venue,e.status,COALESCE(SUM(m.media_type='PHOTO' AND m.deleted_at IS NULL AND (e.feature_photo_path IS NULL OR m.file_path<>e.feature_photo_path)),0) AS photo_count,COALESCE(SUM(m.media_type='VIDEO' AND m.deleted_at IS NULL),0) AS video_count FROM events e LEFT JOIN event_media m ON m.event_id=e.id WHERE ${where} GROUP BY e.id ORDER BY e.event_date DESC,e.id DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
    return NextResponse.json({events:rows,total:Number(counts[0].total),page,limit});
  } catch(error){ console.error("Failed to list events",error); return NextResponse.json({error:databaseErrorHint(error)},{status:503}); }
}

export async function POST(request:Request) {
  let storedLogoPath: string | undefined;
  let storedFeaturePath: string | undefined;
  let createdEventId: number | undefined;
  try {
    const admin=await getCurrentAdmin();
    if(!admin)return NextResponse.json({error:"Administrator sign-in required."},{status:401});
    const fields:Record<string,unknown>={};
    let logoFile:File|null=null, featureFile:File|null=null;
    if(request.headers.get("content-type")?.includes("multipart/form-data")){
      const form=await request.formData();
      for(const [key,value] of form.entries()){
        if(key==="eventLogo"&&value instanceof File){if(value.size>0)logoFile=value;}
        else if(key==="featurePhoto"&&value instanceof File){if(value.size>0)featureFile=value;}
        else if(typeof value==="string")fields[key]=value;
      }
    }else Object.assign(fields,await request.json());
    const title=typeof fields.title==="string"?fields.title.trim():"", description=typeof fields.description==="string"?fields.description.trim():"", venue=typeof fields.venue==="string"?fields.venue.trim():"", passType=typeof fields.passType==="string"?fields.passType:"", eventDate=typeof fields.eventDate==="string"?fields.eventDate:"", startTime=typeof fields.startTime==="string"?fields.startTime:"";
    const errors:Record<string,string>={};
    if(!title)errors.title="Event title is required."; else if(title.length>180)errors.title="Title must be 180 characters or fewer.";
    if(!description)errors.description="Description is required."; if(!venue)errors.venue="Venue is required.";
    if(!["FREE","TICKETED"].includes(passType))errors.passType="Choose a valid pass type.";
    let ticketPrice:string|null=null;
    if(passType==="TICKETED"){
      const price=Number(fields.ticketPrice);
      if(fields.ticketPrice===undefined||fields.ticketPrice===""||!Number.isFinite(price)||price<=0||price>99999999.99)errors.ticketPrice="Enter a ticket price greater than R0 and no more than R99,999,999.99.";
      else ticketPrice=price.toFixed(2);
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate??""))errors.eventDate="Choose a valid event date.";
    if(!/^\d{2}:\d{2}$/.test(startTime??""))errors.startTime="Choose a valid start time.";
    const validImage=async(file:File|null,maxBytes:number,field:string)=>{
      if(!file)return null;
      if(file.size>maxBytes){errors[field]=`Image must be ${maxBytes/(1024*1024)} MB or smaller.`;return null;}
      const bytes=Buffer.from(await file.arrayBuffer());
      const png=file.type==="image/png"&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg=file.type==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      const webp=file.type==="image/webp"&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
      const ext=png?"png":jpg?"jpg":webp?"webp":undefined;
      if(!ext){errors[field]="Choose a valid PNG, JPG, or WebP image.";return null;}
      return {bytes,ext};
    };
    const logo=await validImage(logoFile,5*1024*1024,"eventLogo");
    const feature=await validImage(featureFile,10*1024*1024,"featurePhoto");
    if(!feature)errors.featurePhoto??="Upload an event feature photo.";
    if(Object.keys(errors).length)return NextResponse.json({errors},{status:400});
    if(logo){
      storedLogoPath=`/uploads/event-logos/${randomUUID()}.${logo.ext}`;
      const diskPath=path.join(process.cwd(),"public",storedLogoPath.slice(1));
      await mkdir(path.dirname(diskPath),{recursive:true});
      await writeFile(diskPath,logo.bytes,{flag:"wx"});
    }
    const [result]=await getPool().execute<ResultSetHeader>("INSERT INTO events (title,description,pass_type,ticket_price,event_logo_path,event_date,start_time,venue,status,created_by) VALUES (?,?,?,?,?,?,?,?,'DRAFT',?)",[title,description,passType,ticketPrice,storedLogoPath??null,eventDate,startTime,venue,admin.id]);
    createdEventId=result.insertId;
    if(feature){
      storedFeaturePath=`/uploads/events/${result.insertId}/${randomUUID()}.${feature.ext}`;
      const diskPath=path.join(process.cwd(),"public",storedFeaturePath.slice(1));
      await mkdir(path.dirname(diskPath),{recursive:true});
      await writeFile(diskPath,feature.bytes,{flag:"wx"});
      const conn=await getPool().getConnection();
      try{
        await conn.beginTransaction();
        await conn.execute("UPDATE events SET feature_photo_path=? WHERE id=?",[storedFeaturePath,result.insertId]);
        await conn.execute("INSERT INTO event_media (event_id,media_type,file_name,file_path,mime_type,file_size,created_by) VALUES (?,'PHOTO',?,?,?,?,?)",[result.insertId,"Feature photo",storedFeaturePath,featureFile?.type??"image/jpeg",feature.bytes.length,admin.id]);
        await conn.commit();
      }catch(error){await conn.rollback();throw error;}finally{conn.release();}
    }
    return NextResponse.json({id:result.insertId,status:"DRAFT"},{status:201});
  }catch(error){for(const file of [storedLogoPath,storedFeaturePath])if(file)await unlink(path.join(process.cwd(),"public",file.slice(1))).catch(()=>{});if(createdEventId)await getPool().execute("UPDATE events SET deleted_at=CURRENT_TIMESTAMP WHERE id=?",[createdEventId]).catch(()=>{});console.error("Failed to create event",error);return NextResponse.json({error:databaseErrorHint(error)},{status:503});}
}
