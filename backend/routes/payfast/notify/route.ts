import {NextResponse} from "next/server";
import {createHash,timingSafeEqual,randomUUID} from "node:crypto";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import type {RowDataPacket} from "mysql2/promise";
import {getPool} from "@backend/lib/db";
export const runtime="nodejs";
function signature(values:URLSearchParams,passphrase:string){const pairs=[...values.entries()].filter(([k])=>k!=="signature").map(([k,v])=>`${k}=${encodeURIComponent(v.trim()).replace(/%20/g,"+")}`);if(passphrase)pairs.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g,"+")}`);return createHash("md5").update(pairs.join("&")).digest("hex")}
export async function POST(request:Request){
  const raw=await request.text(),values=new URLSearchParams(raw),given=values.get("signature")??"",expected=signature(values,process.env.PAYFAST_PASSPHRASE??"");
  const a=Buffer.from(given.toLowerCase()),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return new NextResponse("Invalid signature",{status:400});
  const ref=values.get("m_payment_id"),mode=process.env.PAYFAST_MODE==="live"?"https://www.payfast.co.za/eng/query/validate":"https://sandbox.payfast.co.za/eng/query/validate";
  if(!ref)return new NextResponse("Missing payment reference",{status:400});
  try{
    const clientIp=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"";
    const candidates=(await Promise.all(["www.payfast.co.za","sandbox.payfast.co.za","w1w.payfast.co.za","w2w.payfast.co.za"].map(async host=>{try{return (await lookup(host,{all:true})).map(item=>item.address)}catch{return []}}))).flat();
    const normalized=clientIp.startsWith("::ffff:")?clientIp.slice(7):clientIp;
    if(!isIP(normalized)||!candidates.includes(normalized))return new NextResponse("Invalid notification source",{status:403});
    const validationBody=new URLSearchParams([...values.entries()].filter(([key])=>key!=="signature")).toString();
    const validation=await fetch(mode,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:validationBody,cache:"no-store"});
    if(!validation.ok||!(await validation.text()).trim().startsWith("VALID"))return new NextResponse("PayFast validation failed",{status:400});
    const pool=getPool(),conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [orders]=await conn.execute<RowDataPacket[]>("SELECT id,event_id,ticket_id,quantity,total_amount,payment_status,inventory_decremented FROM ticket_orders WHERE order_reference=? FOR UPDATE",[ref]);const order=orders[0];
      if(!order){await conn.rollback();return new NextResponse("Unknown order",{status:404})}
      if(Math.abs(Number(values.get("amount_gross"))-Number(order.total_amount))>0.01){await conn.rollback();return new NextResponse("Amount mismatch",{status:400})}
      if(order.payment_status!=="PENDING"){await conn.commit();return new NextResponse("OK",{status:200})}
      const status=values.get("payment_status");
      if(status==="COMPLETE"){
        if(Number(order.inventory_decremented)===0){
          const [inventory]=await conn.execute<RowDataPacket[]>("SELECT available_quantity FROM event_tickets WHERE id=? FOR UPDATE",[order.ticket_id]);
          if(!inventory[0]||Number(inventory[0].available_quantity)<Number(order.quantity)){
            await conn.rollback();
            console.error("Confirmed PayFast order exceeds remaining ticket inventory",{reference:ref,ticketId:order.ticket_id,quantity:order.quantity});
            return new NextResponse("Insufficient ticket inventory",{status:409});
          }
          await conn.execute("UPDATE event_tickets SET available_quantity=available_quantity-? WHERE id=?",[order.quantity,order.ticket_id]);
        }
        await conn.execute("UPDATE ticket_orders SET payment_status='PAID',inventory_decremented=1 WHERE id=? AND payment_status='PENDING'",[order.id]);
        for(let i=0;i<Number(order.quantity);i++)await conn.execute("INSERT INTO issued_tickets (order_id,event_id,ticket_id,ticket_number) VALUES (?,?,?,?)",[order.id,order.event_id,order.ticket_id,`TKT-${randomUUID().replaceAll("-","").slice(0,20).toUpperCase()}`]);
      }else if(status==="FAILED"||status==="CANCELLED"){
        if(Number(order.inventory_decremented)===1){
          await conn.execute("UPDATE event_tickets SET available_quantity=available_quantity+? WHERE id=?",[order.quantity,order.ticket_id]);
        }
        await conn.execute("UPDATE ticket_orders SET payment_status=?,inventory_decremented=0 WHERE id=? AND payment_status='PENDING'",[status,order.id]);
      }
      await conn.commit();return new NextResponse("OK",{status:200});
    }catch(error){await conn.rollback();throw error}finally{conn.release()}
  }catch(error){console.error("PayFast ITN processing failed",error);return new NextResponse("ITN processing error",{status:500})}
}
