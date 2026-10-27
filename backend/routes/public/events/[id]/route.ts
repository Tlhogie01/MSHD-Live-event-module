import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "@backend/lib/db";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
  const {id}=await params;
  try{
    const [events]=await getPool().execute<RowDataPacket[]>("SELECT id,title,description,pass_type,ticket_price,event_logo_path,feature_photo_path,DATE_FORMAT(event_date,'%Y-%m-%d') AS event_date,TIME_FORMAT(start_time,'%H:%i') AS start_time,venue,status FROM events WHERE id=? AND status IN ('PUBLISHED','COMPLETED') AND deleted_at IS NULL LIMIT 1",[id]);
    if(!events[0])return NextResponse.json({error:"Event not found."},{status:404});
    const [media]=await getPool().execute<RowDataPacket[]>("SELECT m.id,m.media_type,m.file_name,m.file_path,m.mime_type FROM event_media m JOIN events e ON e.id=m.event_id WHERE m.event_id=? AND m.deleted_at IS NULL AND (e.feature_photo_path IS NULL OR m.file_path<>e.feature_photo_path) ORDER BY m.id DESC",[id]);
    let tickets:RowDataPacket[]=[];
    if(events[0].status==='PUBLISHED'){
      [tickets]=await getPool().execute<RowDataPacket[]>("SELECT t.id,t.name,t.description,t.price,(t.available_quantity-COALESCE((SELECT SUM(o.quantity) FROM ticket_orders o WHERE o.ticket_id=t.id AND o.payment_status='PENDING' AND o.inventory_decremented=0),0)) AS available_quantity,t.sale_start,t.sale_end FROM event_tickets t WHERE t.event_id=? AND t.status='ACTIVE' AND t.available_quantity>COALESCE((SELECT SUM(o.quantity) FROM ticket_orders o WHERE o.ticket_id=t.id AND o.payment_status='PENDING' AND o.inventory_decremented=0),0) AND (t.sale_start IS NULL OR t.sale_start<=NOW()) AND (t.sale_end IS NULL OR t.sale_end>=NOW()) ORDER BY t.price,t.id",[id]);
    }
    return NextResponse.json({event:events[0],media,tickets});
  }catch(error){console.error("Could not load public event",error);return NextResponse.json({error:"Event details are temporarily unavailable."},{status:503});}
}
