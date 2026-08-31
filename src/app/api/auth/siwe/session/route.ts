import { createSiweHandlers } from "../handlers";

const handlers = createSiweHandlers();
export const GET = handlers.session;
export const DELETE = handlers.logout;
