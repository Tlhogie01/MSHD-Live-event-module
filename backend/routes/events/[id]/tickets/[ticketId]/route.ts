import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentAdmin } from "@backend/lib/auth";
import { getPool } from "@backend/lib/db";

type Context={params:Promise<{id:string;ticketId:string}>};

export async function PUT(request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id,ticketId}=await params;
  const body=await request.json();
  const name=typeof body.name==="string"?body.name.trim():"",description=typeof body.description==="string"?body.description.trim():"";
  const price=Number(body.price),quantity=Number(body.quantity),status=body.status==="INACTIVE"?"INACTIVE":"ACTIVE";
  if(!name||name.length>120||!Number.isFinite(price)||price<=0||price>99999999.99||!Number.isInteger(quantity)||quantity<1)return NextResponse.json({error:"Enter a ticket name, price greater than zero, and quantity greater than zero."},{status:400});
  try{
    const conn=await getPool().getConnection();
    try{
      await conn.beginTransaction();
      const [current]=await conn.execute<RowDataPacket[]>("SELECT quantity,available_quantity FROM event_tickets WHERE id=? AND event_id=? FOR UPDATE",[ticketId,id]);
      if(!current.length){await conn.rollback();return NextResponse.json({error:"Ticket type not found."},{status:404});}
      const [salesRows]=await conn.execute<RowDataPacket[]>("SELECT COALESCE(SUM(quantity),0) AS sold FROM ticket_orders WHERE ticket_id=? AND payment_status='PAID'",[ticketId]);
      const [pendingRows]=await conn.execute<RowDataPacket[]>("SELECT COALESCE(SUM(quantity),0) AS pending FROM ticket_orders WHERE ticket_id=? AND payment_status='PENDING'",[ticketId]);
      const [legacyPendingRows]=await conn.execute<RowDataPacket[]>("SELECT COALESCE(SUM(quantity),0) AS pending FROM ticket_orders WHERE ticket_id=? AND payment_status='PENDING' AND inventory_decremented=1",[ticketId]);
      const sold=Number(salesRows[0]?.sold??0);
      const pending=Number(pendingRows[0]?.pending??0);
      const legacyPending=Number(legacyPendingRows[0]?.pending??0);
      if(quantity<sold+pending){await conn.rollback();return NextResponse.json({error:`Quantity cannot be lower than ${sold} confirmed sales plus ${pending} pending checkout reservation(s).`},{status:400});}
      const available=quantity-sold-legacyPending;
      const [result]=await conn.execute<ResultSetHeader>("UPDATE event_tickets SET name=?,description=?,price=?,quantity=?,available_quantity=?,sale_start=?,sale_end=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?",[name,description||null,price,quantity,available,body.saleStart||null,body.saleEnd||null,status,ticketId,id]);
      await conn.commit();
      return NextResponse.json({ok:!!result.affectedRows,availableQuantity:available});
    }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  }catch(error){console.error("Could not update ticket type",error);return NextResponse.json({error:"Could not update ticket type."},{status:503});}
}

export async function DELETE(_request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id,ticketId}=await params;
  try{
    const [result]=await getPool().execute<ResultSetHeader>("UPDATE event_tickets SET status='INACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?",[ticketId,id]);
    if(!result.affectedRows)return NextResponse.json({error:"Ticket type not found."},{status:404});
    return NextResponse.json({ok:true});
  }catch(error){console.error("Could not deactivate ticket type",error);return NextResponse.json({error:"Could not remove ticket type."},{status:503});}
}
