// Vercel Serverless Function Handler for POST /api/assistant
// Adheres strictly to 01_PRD.md, 03_ARCHITECTURE.md, 05_API.md, and 16_SECURITY_AUDIT.md

import type { IncomingMessage, ServerResponse } from 'http';
import { handleAssistantRequest } from '../src/lib/assistant/serverEndpoint';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed. Use POST.' },
      })
    );
    return;
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      if (payload.length > 10240) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds maximum allowed size of 10KB.' },
          })
        );
        return;
      }
      payload = JSON.parse(payload);
    } else if (!payload) {
      // Parse incoming stream if not pre-parsed by framework with size bound
      const buffers: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of req) {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        totalBytes += buf.length;
        if (totalBytes > 10240) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds maximum allowed size of 10KB.' },
            })
          );
          return;
        }
        buffers.push(buf);
      }
      const rawText = Buffer.concat(buffers).toString('utf-8');
      payload = rawText ? JSON.parse(rawText) : null;
    }

    // Safely extract client IP from x-forwarded-for (take first hop)
    const rawForwarded = req.headers['x-forwarded-for'];
    const clientIdentifier =
      (typeof rawForwarded === 'string'
        ? rawForwarded.split(',')[0].trim()
        : Array.isArray(rawForwarded)
        ? rawForwarded[0].split(',')[0].trim()
        : null) ||
      req.socket.remoteAddress ||
      'vercel-client';

    const result = await handleAssistantRequest(payload, clientIdentifier);

    res.statusCode = result.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result.body));
  } catch (_err: unknown) {
    // Prevent internal error and stack trace leakage (05_API.md)
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body. Ensure payload is a valid JSON object.',
        },
      })
    );
  }
}
