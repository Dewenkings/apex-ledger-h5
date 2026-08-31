import { createSessionHandlers } from "./handlers";
const handlers = createSessionHandlers();
export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
