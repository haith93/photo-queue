// Cloudflare Pages Function: every /api/* request goes to lib/api.js.
import { handle } from '../../lib/api.js';

export const onRequest = ({ request, env }) => handle(request, env);
