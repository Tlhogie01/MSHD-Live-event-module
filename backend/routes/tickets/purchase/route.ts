import {NextResponse} from "next/server";
import {createHash,randomUUID} from "node:crypto";
import type {RowDataPacket,ResultSetHeader} from "mysql2/promise";
import {getPool} from "@backend/lib/db";
export const runtime="nodejs";
function sign(fields:Record<string,string>,passphrase:string){const body=Object.entries(fields).map(([k,v])=>`${k}=${encodeURIComponent(v.trim()).replace(/%20/g,"+")}`).join("&");return createHash("md5").update(passphrase?`${body}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g,"+")}`:body).digest("hex")}
export async function POST(request:Request){
  const merchantId=process.env.PAYFAST_MERCHANT_ID,merchantKey=process.env.PAYFAST_MERCHANT_KEY,base=process.env.APP_BASE_URL,secret=process.env.PAYFAST_PASSPHRASE??"";
  if(!merchantId||!merchantKey||!base)return NextResponse.json({error:"PayFast is not configured yet. Add its credentials and APP_BASE_URL, then restart the app."},{status:503});
  let body:{eventId?:string;ticketId?:string;quantity?:string;customerName?:string;customerEmail?:string};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid purchase request."},{status:400})}
  const qty=Number(body.quantity),name=typeof body.customerName==="string"?body.customerName.trim():"",email=typeof body.customerEmail==="string"?body.customerEmail.trim().toLowerCase():"";
  if(!Number.isInteger(qty)||qty<1||qty>10||!name||name.length>180||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return NextResponse.json({error:"Enter your name, valid email, and a quantity from 1 to 10."},{status:400});
  const pool=getPool(),conn=await pool.getConnection(),reference=`MSHD-${randomUUID().replaceAll("-","").slice(0,24).toUpperCase()}`;
  try{
    await conn.beginTransaction();
    const [rows]=await conn.execute<RowDataPacket[]>("SELECT t.id,t.event_id,t.name,t.price,t.available_quantity,e.title FROM event_tickets t JOIN events e ON e.id=t.event_id WHERE t.id=? AND t.event_id=? AND t.status='ACTIVE' AND e.status='PUBLISHED' AND e.deleted_at IS NULL AND (t.sale_start IS NULL OR t.sale_start<=NOW()) AND (t.sale_end IS NULL OR t.sale_end>=NOW()) FOR UPDATE",[body.ticketId,body.eventId]);
    const ticket=rows[0];if(!ticket)throw new Error("This ticket is no longer available.");
    const [reservations]=await conn.execute<RowDataPacket[]>("SELECT COALESCE(SUM(quantity),0) AS reserved FROM ticket_orders WHERE ticket_id=? AND payment_status='PENDING' AND inventory_decremented=0",[ticket.id]);
    const reserved=Number(reservations[0]?.reserved??0);
    if(Number(ticket.available_quantity)-reserved<qty)throw new Error("There are not enough tickets available.");
    const total=(Number(ticket.price)*qty).toFixed(2);if(Number(total)<5)throw new Error("PayFast requires a minimum payment amount of R5.00.");
    await conn.execute<ResultSetHeader>("INSERT INTO ticket_orders (event_id,ticket_id,quantity,total_amount,payment_status,inventory_decremented,order_reference,customer_name,customer_email) VALUES (?,?,?,?,'PENDING',0,?,?,?)",[ticket.event_id,ticket.id,qty,total,reference,name,email]);
    await conn.commit();
    const [first,...rest]=name.split(/\s+/);const fields:Record<string,string>={merchant_id:merchantId,merchant_key:merchantKey,return_url:`${base}/checkout/${reference}?status=complete`,cancel_url:`${base}/checkout/${reference}?status=cancelled`,notify_url:`${base}/api/payfast/notify`,name_first:first,name_last:rest.join(" ")||first,email_address:email,m_payment_id:reference,amount:total,item_name:String(ticket.title).slice(0,100),item_description:String(ticket.name).slice(0,255)};fields.signature=sign(fields,secret);
    const gateway=process.env.PAYFAST_MODE==="live"?"https://www.payfast.co.za/eng/process":"https://sandbox.payfast.co.za/eng/process";
    return NextResponse.json({gateway,fields,reference});
  }catch(error){await conn.rollback();return NextResponse.json({error:error instanceof Error?error.message:"Could not start ticket checkout."},{status:400})}finally{conn.release()}
}
