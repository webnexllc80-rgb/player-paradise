import { getAdminSessionUser, isStaffRole } from '@/lib/auth';
import { staffBroadcaster } from '@/lib/staffStream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const session = await getAdminSessionUser();
    if (!session || !isStaffRole(session.role)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      start(controller) {
        // 1. Initial handshake
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`)
        );

        // 2. Real-time staff event forwarder
        const onStaffEvent = (payload) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`event: staff_alert\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch (err) {
            isClosed = true;
          }
        };

        staffBroadcaster.on('staff_event', onStaffEvent);

        // 3. Keep-alive heartbeat every 15s to keep connections alive through proxies / Cloudflare / Nginx
        const heartbeat = setInterval(() => {
          if (isClosed) {
            clearInterval(heartbeat);
            return;
          }
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (err) {
            isClosed = true;
            clearInterval(heartbeat);
          }
        }, 15000);

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(heartbeat);
          staffBroadcaster.off('staff_event', onStaffEvent);
          try {
            controller.close();
          } catch {}
        };

        req.signal?.addEventListener('abort', cleanup);
      },
      cancel() {
        isClosed = true;
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform, no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Critical for Nginx reverse proxies
      },
    });
  } catch (err) {
    console.error('SSE Stream error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
