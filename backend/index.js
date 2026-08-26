import app from './src/app.js';
import { config } from './src/config.js';

// Guard app.listen() to only run when NOT running inside Vercel serverless environment
if (!process.env.VERCEL) {
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[QuickShare Server] Running on http://localhost:${config.port}`);
    console.log(`[QuickShare Server] LAN URL: http://0.0.0.0:${config.port}`);
  });

  // Optimize TCP Sockets for maximum throughput and zero latency
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.maxRequestsPerSocket = 0;

  server.on('connection', (socket) => {
    socket.setNoDelay(true); // Disable Nagle's algorithm for instant packet dispatch
    socket.setKeepAlive(true, 10000);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n[QuickShare Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[QuickShare Server] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Export the Express app for Vercel Functions / Services
export default app;
export { app };
