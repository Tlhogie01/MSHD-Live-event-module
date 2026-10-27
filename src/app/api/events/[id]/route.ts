import { GET as GETHandler, PUT as PUTHandler, PATCH as PATCHHandler, DELETE as DELETEHandler } from "@backend/routes/events/[id]/route";
export const runtime = "nodejs";
export const GET = GETHandler;
export const PUT = PUTHandler;
export const PATCH = PATCHHandler;
export const DELETE = DELETEHandler;