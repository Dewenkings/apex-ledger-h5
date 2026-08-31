import { createSiweHandlers } from "../handlers";

const handlers = createSiweHandlers();
export const POST = handlers.verify;
