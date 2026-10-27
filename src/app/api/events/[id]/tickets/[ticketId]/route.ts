import { PUT as PUTHandler, DELETE as DELETEHandler } from "@backend/routes/events/[id]/tickets/[ticketId]/route";
export const runtime = "nodejs";
export const PUT = PUTHandler;
export const DELETE = DELETEHandler;