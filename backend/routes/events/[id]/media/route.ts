import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { getCurrentAdmin } from "@backend/lib/auth";
import { getPool } from "@backend/lib/db";

export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
type Upload={file:File;type:"PHOTO"|"VIDEO";extension:string;bytes:Buffer;storedPath:string;originalName:string};

function imageExtension(file:File,bytes:Buffer){
  if(file.type==="image/png"&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "png";
  if(file.type==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "jpg";
  if(file.type==="image/webp"&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "webp";
  return null;
}
function videoExtension(file:File,bytes:Buffer){
  if(file.type==="video/webm"&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return "webm";
  if((file.type==="video/mp4"||file.type==="video/quicktime")&&bytes.toString("ascii",4,8)==="ftyp")return file.type==="video/quicktime"?"mov":"mp4";
  return null;
}

export async function GET(_request:Request,{params}:Context){
  if(!await getCurrentAdmin())return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  try{
    const [rows]=await getPool().execute<RowDataPacket[]>("SELECT m.id,m.media_type,m.file_name,m.file_path,m.mime_type,m.file_size,m.created_at,(e.feature_photo_path=m.file_path) AS is_feature FROM event_media m JOIN events e ON e.id=m.event_id WHERE m.event_id=? AND m.deleted_at IS NULL ORDER BY m.id DESC",[id]);
    return NextResponse.json({media:rows});
  }catch(error){console.error("Could not list event media",error);return NextResponse.json({error:"Could not load event media."},{status:503});}
}

export async function POST(request:Request,{params}:Context){
  const admin=await getCurrentAdmin();
  if(!admin)return NextResponse.json({error:"Administrator sign-in required."},{status:401});
  const {id}=await params;
  const saved:string[]=[];
  try{
    const form=await request.formData();
    const mediaKind=form.get("mediaType")==="VIDEO"?"VIDEO":"PHOTO";
    const setFeature=form.get("setFeaturePhoto")==="true";
    const files=form.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0);
    if(!files.length)return NextResponse.json({error:"Choose at least one file to upload."},{status:400});
    if(files.length>20)return NextResponse.json({error:"Upload up to 20 files at a time."},{status:400});
    if(setFeature&&mediaKind!=="PHOTO")return NextResponse.json({error:"Only an image can be the feature photo."},{status:400});
    const [events]=await getPool().execute<RowDataPacket[]>("SELECT id FROM events WHERE id=? AND deleted_at IS NULL",[id]);
    if(!events.length)return NextResponse.json({error:"Event not found."},{status:404});
    const uploads:Upload[]=[];
    for(const file of files){
      const limit=mediaKind==="PHOTO"?10*1024*1024:100*1024*1024;
      if(file.size>limit)return NextResponse.json({error:`${file.name} exceeds the ${mediaKind==="PHOTO"?"10 MB photo":"100 MB video"} limit.`},{status:400});
      const bytes=Buffer.from(await file.arrayBuffer());
      const extension=mediaKind==="PHOTO"?imageExtension(file,bytes):videoExtension(file,bytes);
      if(!extension)return NextResponse.json({error:`${file.name} has an unsupported or invalid file format.`},{status:400});
      const safeOriginal=file.name.replace(/[\\/\0-\x1f]/g,"_").slice(-200)||`upload.${extension}`;
      uploads.push({file,type:mediaKind,extension,bytes,storedPath:`/uploads/events/${id}/${randomUUID()}.${extension}`,originalName:safeOriginal});
    }
    for(const upload of uploads){const disk=path.join(process.cwd(),"public",upload.storedPath.slice(1));await mkdir(path.dirname(disk),{recursive:true});await writeFile(disk,upload.bytes,{flag:"wx"});saved.push(disk);}
    const conn=await getPool().getConnection();
    try{
      await conn.beginTransaction();
      for(const upload of uploads){
        await conn.execute<ResultSetHeader>("INSERT INTO event_media (event_id,media_type,file_name,file_path,mime_type,file_size,created_by) VALUES (?,?,?,?,?,?,?)",[id,upload.type,upload.originalName,upload.storedPath,upload.file.type,upload.file.size,admin.id]);
      }
      if(setFeature&&uploads[0])await conn.execute("UPDATE events SET feature_photo_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[uploads[0].storedPath,id]);
      await conn.commit();
    }catch(error){await conn.rollback();throw error;}finally{conn.release();}
    return NextResponse.json({uploaded:uploads.length},{status:201});
  }catch(error){await Promise.all(saved.map(file=>unlink(file).catch(()=>{})));console.error("Could not upload event media",error);return NextResponse.json({error:"Could not save uploaded media."},{status:503});}
}
