import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';

const MAX_BRIDGE_BODY_BYTES = 1024 * 1024;

function isLoopback(address?: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function filesystemBridge(): Plugin {
  const bridgeDir = path.resolve(process.env.RAGBOT_BRIDGE_DIR || process.cwd());
  const observationsFile = path.join(bridgeDir, 'RAGBOT_OBSERVATIONS.md');
  const commandsFile = path.join(bridgeDir, 'RAGBOT_COMMANDS.md');

  return {
    name: 'ragbot-filesystem-bridge',
    configureServer(server) {
      const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      };

      const requireLoopback = (req: IncomingMessage, res: ServerResponse): boolean => {
        if (isLoopback(req.socket.remoteAddress)) return true;
        sendJson(res, 403, { error: 'The filesystem bridge only accepts loopback clients.' });
        return false;
      };

      server.middlewares.use('/api/observations', (req, res) => {
        if (!requireLoopback(req, res)) return;

        if (req.method === 'GET') {
          const content = fs.existsSync(observationsFile)
            ? fs.readFileSync(observationsFile, 'utf-8')
            : '';
          sendJson(res, 200, { content });
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed.' });
          return;
        }

        let body = '';
        let tooLarge = false;
        req.on('data', (chunk: Buffer) => {
          if (tooLarge) return;
          body += chunk.toString();
          if (Buffer.byteLength(body) > MAX_BRIDGE_BODY_BYTES) {
            tooLarge = true;
            body = '';
          }
        });
        req.on('end', () => {
          if (tooLarge) {
            sendJson(res, 413, { error: 'Observation payload exceeds 1 MiB.' });
            return;
          }

          try {
            const parsed = JSON.parse(body);
            if (typeof parsed.content !== 'string') {
              sendJson(res, 400, { error: 'content must be a string.' });
              return;
            }
            fs.mkdirSync(bridgeDir, { recursive: true });
            fs.writeFileSync(observationsFile, parsed.content, 'utf-8');
            sendJson(res, 200, { written: true });
          } catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON.' });
          }
        });
      });

      server.middlewares.use('/api/commands', (req, res) => {
        if (!requireLoopback(req, res)) return;
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed.' });
          return;
        }
        const content = fs.existsSync(commandsFile) ? fs.readFileSync(commandsFile, 'utf-8') : '';
        sendJson(res, 200, { content });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [filesystemBridge(), react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'test-harness': path.resolve(__dirname, 'test-harness.html'),
        },
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.worklet.js')) {
              return 'audio/[name][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
  };
});
