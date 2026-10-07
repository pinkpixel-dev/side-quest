import { spawn, type ChildProcess } from 'node:child_process';

export interface Tunnel {
  url: string;
  stop(): void;
}

/**
 * Starts a cloudflared quick tunnel (no account needed) and resolves with its public
 * https URL. The URL changes every run; the phone app re-pairs by scanning the new QR.
 */
export function startTunnel(port: number, timeoutMs = 45_000): Promise<Tunnel> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(err);
      return;
    }
    const stop = () => child.kill('SIGTERM');
    const timer = setTimeout(() => {
      stop();
      reject(new Error('cloudflared did not hand out a URL in time.'));
    }, timeoutMs);

    let log = '';
    const onData = (chunk: Buffer) => {
      log += chunk.toString();
      const url = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
      // Wait for a registered connection too, otherwise the first requests 530.
      if (url && /Registered tunnel connection/.test(log)) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        resolve({ url, stop });
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err.message.includes('ENOENT') ? new Error('cloudflared is not installed.') : err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`cloudflared exited (${code}).`));
    });
  });
}
