import { PATCH as PATCHHandler, DELETE as DELETEHandler } from "@backend/routes/events/[id]/media/[mediaId]/route";
export const runtime = "nodejs";
export const PATCH = PATCHHandler;
export const DELETE = DELETEHandler;