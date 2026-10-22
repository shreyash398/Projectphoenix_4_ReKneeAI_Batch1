import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleAssistantRequest } from './src/lib/assistant/serverEndpoint';

// Server-side middleware plugin for POST /api/assistant
function assistantApiPlugin(): Plugin {
  return {
    name: 'assistant-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/assistant', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' },
            })
          );
          return;
        }

        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = bodyStr ? JSON.parse(bodyStr) : null;
            const clientIp = req.socket.remoteAddress || '127.0.0.1';
            const result = await handleAssistantRequest(payload, clientIp);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: { code: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
              })
            );
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), assistantApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
