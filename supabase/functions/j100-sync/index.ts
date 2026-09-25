import { createHandler } from './handler.mjs';
Deno.serve(createHandler({ env: (key: string) => Deno.env.get(key) }));
