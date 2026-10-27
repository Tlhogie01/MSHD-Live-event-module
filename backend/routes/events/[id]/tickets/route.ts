import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentAdmin } from "@backend/lib/auth";
import { getPool } from "@backend/lib/db";

type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const [rows]=await getPool().execute<RowDataPacket[]>("SELECT t.id,t.event_id,t.name,t.description,t.price,t.quantity,t.available_quantity,COALESCE((SELECT SUM(o.quantity) FROM ticket_orders o WHERE o.ticket_id=t.id AND o.payment_status='PAID'),0) AS confirmed_sold,COALESCE((SELECT SUM(o.quantity) FROM ticket_orders o WHERE o.ticket_id=t.id AND o.payment_status='PENDING'),0) AS pending_quantity,(t.available_quantity-COALESCE((SELECT SUM(o.quantity) FROM ticket_orders o WHERE o.ticket_id=t.id AND o.payment_status='PENDING' AND o.inventory_decremented=0),0)) AS purchasable_quantity,t.sale_start,t.sale_end,t.status,t.created_at,t.updated_at FROM event_tickets t WHERE t.event_id=? ORDER BY t.id",[id]);
    return NextResponse.json({tickets:rows});
  }catch(error){console.error("Could not list ticket types",error);return NextResponse.json({error:"Could not load ticket types."},{status:503});}
}

export async function POST(request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const body=await request.json();
    const name=typeof body.name==="string"?body.name.trim():"",description=typeof body.description==="string"?body.description.trim():"";
    const price=Number(body.price),quantity=Number(body.quantity),status=body.status==="INACTIVE"?"INACTIVE":"ACTIVE";
    if(!name||name.length>120||!Number.isFinite(price)||price<=0||price>99999999.99||!Number.isInteger(quantity)||quantity<1||quantity>4294967295)return NextResponse.json({error:"Enter a ticket name, price greater than zero, and quantity greater than zero."},{status:400});
    if(body.saleStart&&body.saleEnd&&new Date(body.saleStart)>=new Date(body.saleEnd))return NextResponse.json({error:"Sale end must be after sale start."},{status:400});
    const pool=getPool();
    const [events]=await pool.execute<RowDataPacket[]>("SELECT id,pass_type FROM events WHERE id=? AND deleted_at IS NULL",[id]);
    if(!events.length)return NextResponse.json({error:"Event not found."},{status:404});
    if(events[0].pass_type!=="TICKETED")return NextResponse.json({error:"Ticket types can only be added to ticketed events."},{status:400});
    const [result]=await pool.execute<ResultSetHeader>("INSERT INTO event_tickets (event_id,name,description,price,quantity,available_quantity,sale_start,sale_end,status) VALUES (?,?,?,?,?,?,?,?,?)",[id,name,description||null,price,quantity,quantity,body.saleStart||null,body.saleEnd||null,status]);
    return NextResponse.json({id:result.insertId},{status:201});
  }catch(error){console.error("Could not create ticket type",error);return NextResponse.json({error:"Could not create ticket type."},{status:503});}
}
