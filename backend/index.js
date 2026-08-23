import app from './src/app.js';
import { config } from './src/config.js';

// Guard app.listen() to only run when NOT running inside Vercel serverless environment
if (!process.env.VERCEL) {
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[QuickShare Server] Running on http://localhost:${config.port}`);
    console.log(`[QuickShare Server] LAN URL: http://0.0.0.0:${config.port}`);
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
