// `npm run home`: serves the built app, relays finds between the phone and the laptop tab
// running Gemma, and opens a cloudflared quick tunnel so the phone can reach it.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { HOME_PORT } from '../src/lib/home/protocol.ts';
import { createHomeServer } from './app.ts';
import { Store } from './store.ts';
import { startTunnel, type Tunnel } from './tunnel.ts';

const port = Number(process.env.SIDE_QUEST_PORT ?? HOME_PORT);
/** The deployed app (stable origin). Without it, the phone loads the app through the tunnel. */
const appUrl = process.env.SIDE_QUEST_APP_URL?.replace(/\/$/, '') ?? null;
const staticDir = join(import.meta.dirname, '..', 'dist');

const store = new Store();
let tunnelUrl: string | null = null;
let pairUrl: string | null = null;
let qrSvg: string | null = null;

const server = createHomeServer({
  store,
  staticDir: existsSync(staticDir) ? staticDir : undefined,
  session: () => ({ tunnelUrl, pairUrl, qrSvg }),
});

server.listen(port, '127.0.0.1', async () => {
  const local = `http://127.0.0.1:${port}`;
  console.log(`\n  Side Quest home base`);
  console.log(`  Photos are kept in ${store.dir}`);
  console.log(`\n  Open ${local} on this computer and leave the tab running. That's where Gemma lives.\n`);
  if (!existsSync(staticDir)) console.log('  (No build found. Run `npm run build` so the app can be served.)\n');

  if (process.argv.includes('--no-tunnel')) return;
  console.log('  Opening a tunnel for your phone…');
  let tunnel: Tunnel;
  try {
    tunnel = await startTunnel(port);
  } catch (err) {
    console.error(`  Tunnel failed: ${(err as Error).message} The phone can't connect, but solo mode still works.`);
    return;
  }
  tunnelUrl = tunnel.url;
  const hash = `token=${encodeURIComponent(store.token)}`;
  pairUrl = appUrl ? `${appUrl}/pair#base=${encodeURIComponent(tunnel.url)}&${hash}` : `${tunnel.url}/pair#${hash}`;
  qrSvg = await QRCode.toString(pairUrl, { type: 'svg', margin: 1, color: { dark: '#1f2620', light: '#f3efe2' } });

  console.log(`\n  Scan with your phone camera to pair:\n`);
  console.log(await QRCode.toString(pairUrl, { type: 'terminal', small: true }));
  console.log(`  Or open: ${pairUrl}\n`);
  console.log('  Give it ~15 seconds before scanning. New tunnel addresses take a moment to go live.\n');

  const shutdown = () => {
    tunnel.stop();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
