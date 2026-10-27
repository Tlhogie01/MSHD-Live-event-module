import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentAdmin } from "@backend/lib/auth";
import { getPool } from "@backend/lib/db";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
type EventDetail = RowDataPacket & { id:number; title:string; description:string; pass_type:"FREE"|"TICKETED"; ticket_price:string|null; event_logo_path:string|null; feature_photo_path:string|null; event_date:string; start_time:string; venue:string; status:string };

async function authorized() {
  const admin=await getCurrentAdmin();
  return admin;
}

export async function GET(_request:Request,{params}:RouteContext){
  if(!await authorized())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const [rows]=await getPool().execute<EventDetail[]>("SELECT id,title,description,pass_type,ticket_price,event_logo_path,feature_photo_path,DATE_FORMAT(event_date,'%Y-%m-%d') AS event_date,TIME_FORMAT(start_time,'%H:%i') AS start_time,venue,status,created_at,updated_at FROM events WHERE id=? AND deleted_at IS NULL LIMIT 1",[id]);
    if(!rows[0])return NextResponse.json({error:"Event not found."},{status:404});
    const [[tickets],[media],[sales]]=await Promise.all([
      getPool().execute<RowDataPacket[]>("SELECT id,name,description,price,quantity,available_quantity,sale_start,sale_end,status FROM event_tickets WHERE event_id=? ORDER BY price ASC,id ASC",[id]),
      getPool().execute<RowDataPacket[]>("SELECT m.id,m.media_type,m.file_name,m.file_path,m.mime_type,m.file_size,m.created_at FROM event_media m JOIN events e ON e.id=m.event_id WHERE m.event_id=? AND m.deleted_at IS NULL AND (e.feature_photo_path IS NULL OR m.file_path<>e.feature_photo_path) ORDER BY m.id DESC",[id]),
      getPool().execute<RowDataPacket[]>("SELECT COUNT(*) AS orders,COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END),0) AS revenue,COALESCE(SUM(CASE WHEN payment_status='PAID' THEN quantity ELSE 0 END),0) AS tickets_sold FROM ticket_orders WHERE event_id=?",[id]),
    ]);
    return NextResponse.json({event:rows[0],tickets,media,stats:{orders:Number(sales[0]?.orders??0),revenue:Number(sales[0]?.revenue??0),ticketsSold:Number(sales[0]?.tickets_sold??0)}});
  }catch(error){console.error("Failed to load event details",error);return NextResponse.json({error:"Could not load this event."},{status:503});}
}

export async function PUT(request:Request,{params}:RouteContext){
  const admin=await authorized();
  if(!admin)return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const body=await request.json();
    const title=typeof body.title==="string"?body.title.trim():"",description=typeof body.description==="string"?body.description.trim():"",venue=typeof body.venue==="string"?body.venue.trim():"",passType=body.passType,eventDate=body.eventDate,startTime=body.startTime;
    const errors:Record<string,string>={};
    if(!title||title.length>180)errors.title="Enter an event title (180 characters or fewer).";
    if(!description)errors.description="Description is required.";
    if(!venue)errors.venue="Venue is required.";
    if(!["FREE","TICKETED"].includes(passType))errors.passType="Choose a valid pass type.";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate??""))errors.eventDate="Choose a valid event date.";
    if(!/^\d{2}:\d{2}$/.test(startTime??""))errors.startTime="Choose a valid start time.";
    let ticketPrice:string|null=null;
    if(passType==="TICKETED"){
      const price=Number(body.ticketPrice);
      if(body.ticketPrice===undefined||body.ticketPrice===""||!Number.isFinite(price)||price<=0||price>99999999.99)errors.ticketPrice="Enter a valid ticket price.";
      else ticketPrice=price.toFixed(2);
    }
    if(Object.keys(errors).length)return NextResponse.json({errors},{status:400});
    const [result]=await getPool().execute<ResultSetHeader>("UPDATE events SET title=?,description=?,venue=?,pass_type=?,ticket_price=?,event_date=?,start_time=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",[title,description,venue,passType,ticketPrice,eventDate,startTime,id]);
    if(!result.affectedRows)return NextResponse.json({error:"Event not found."},{status:404});
    return NextResponse.json({ok:true});
  }catch(error){console.error("Failed to update event",error);return NextResponse.json({error:"Could not update this event."},{status:503});}
}

export async function PATCH(request:Request,{params}:RouteContext){
  if(!await authorized())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const {status}=await request.json();
    if(status!=="PUBLISHED"&&status!=="UNPUBLISHED")return NextResponse.json({error:"Choose publish or unpublish."},{status:400});
    const pool=getPool();
    const [events]=await pool.execute<EventDetail[]>("SELECT id,title,description,pass_type,feature_photo_path,event_date,start_time,venue FROM events WHERE id=? AND deleted_at IS NULL LIMIT 1",[id]);
    const event=events[0];
    if(!event)return NextResponse.json({error:"Event not found."},{status:404});
    if(status==="PUBLISHED"){
      const missing: string[]=[];
      if(!event.title||!event.description||!event.event_date||!event.start_time||!event.venue||!event.feature_photo_path)missing.push("event details and a feature photo");
      if(event.pass_type==="TICKETED"){
        const [tickets]=await pool.execute<RowDataPacket[]>("SELECT id FROM event_tickets WHERE event_id=? AND status='ACTIVE' AND quantity>0 LIMIT 1",[id]);
        if(!tickets.length)missing.push("at least one active ticket type with inventory");
      }
      if(missing.length)return NextResponse.json({error:`Before publishing, add ${missing.join(" and ")}.`},{status:400});
    }
    await pool.execute("UPDATE events SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",[status,id]);
    return NextResponse.json({ok:true,status});
  }catch(error){console.error("Failed to change event status",error);return NextResponse.json({error:"Could not change the event status."},{status:503});}
}

export async function DELETE(_request:Request,{params}:RouteContext){
  if(!await authorized())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const [result]=await getPool().execute<ResultSetHeader>("UPDATE events SET deleted_at=CURRENT_TIMESTAMP,status='UNPUBLISHED' WHERE id=? AND deleted_at IS NULL",[id]);
    if(!result.affectedRows)return NextResponse.json({error:"Event not found."},{status:404});
    return NextResponse.json({ok:true});
  }catch(error){console.error("Failed to delete event",error);return NextResponse.json({error:"Could not delete this event."},{status:503});}
}
