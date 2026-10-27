import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { getCurrentAdmin } from "@backend/lib/auth";
import { getPool } from "@backend/lib/db";

type Context={params:Promise<{id:string;mediaId:string}>};
export async function PATCH(_request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id,mediaId}=await params;
  try{
    const [rows]=await getPool().execute<RowDataPacket[]>("SELECT file_path,media_type FROM event_media WHERE id=? AND event_id=? AND deleted_at IS NULL LIMIT 1",[mediaId,id]);
    if(!rows[0])return NextResponse.json({error:"Media item not found."},{status:404});
    if(rows[0].media_type!=="PHOTO")return NextResponse.json({error:"Only a photo can be the feature photo."},{status:400});
    await getPool().execute("UPDATE events SET feature_photo_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",[rows[0].file_path,id]);
    return NextResponse.json({ok:true});
  }catch(error){console.error("Could not set feature photo",error);return NextResponse.json({error:"Could not set feature photo."},{status:503});}
}
export async function DELETE(_request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id,mediaId}=await params;
  try{
    const [rows]=await getPool().execute<RowDataPacket[]>("SELECT file_path FROM event_media WHERE id=? AND event_id=? AND deleted_at IS NULL LIMIT 1",[mediaId,id]);
    if(!rows.length)return NextResponse.json({error:"Media item not found."},{status:404});
    const filePath=String(rows[0].file_path);
    const [result]=await getPool().execute<ResultSetHeader>("UPDATE event_media SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=? AND deleted_at IS NULL",[mediaId,id]);
    if(!result.affectedRows)return NextResponse.json({error:"Media item not found."},{status:404});
    await getPool().execute("UPDATE events SET feature_photo_path=NULL WHERE id=? AND feature_photo_path=?",[id,filePath]);
    const allowedRoot=path.resolve(process.cwd(),"public","uploads","events",id);
    const disk=path.resolve(process.cwd(),"public",filePath.replace(/^\//,""));
    if(disk.startsWith(allowedRoot+path.sep))await unlink(disk).catch(()=>{});
    return NextResponse.json({ok:true});
  }catch(error){console.error("Could not delete event media",error);return NextResponse.json({error:"Could not remove this media item."},{status:503});}
}
