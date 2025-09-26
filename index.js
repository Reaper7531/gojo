import { GojoBot } from "./src/bot.js";

async function main() {
  const bot = new GojoBot();

  try {
    await bot.initialize();
    await bot.start();

    // Handle process termination
    const shutdown = () => bot.shutdown();
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

// Start the bot
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
export { main };
