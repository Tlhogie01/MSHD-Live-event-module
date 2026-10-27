import { GET as GETHandler, POST as POSTHandler } from "@backend/routes/events/[id]/tickets/route";
export const runtime = "nodejs";
export const GET = GETHandler;
export const POST = POSTHandler;