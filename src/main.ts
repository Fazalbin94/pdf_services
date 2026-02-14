import { buildApp } from './app.js';
import { getConfig } from './infrastructure/config.js';


async function main() {
  const config = getConfig();
  const app = await buildApp();

  // Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                      FORM SERVICE                         ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on: http://${config.HOST}:${config.PORT}                ║
║  Environment: ${config.NODE_ENV.padEnd(42)}║
║  Swagger Docs: http://${config.HOST}:${config.PORT}/docs               ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
