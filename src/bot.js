// bot.js

import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  Collection,
} from "discord.js";
import { CONFIG } from "./config/config.js";
import { RateLimiter } from "./utils/rateLimiter.js";
import { DatabaseService } from "./database/dbService.js";
import { AIService } from "./ai/aiService.js";
import { handleMessage } from "./handlers/messageHandler.js";

export class GojoBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.client.snipes = new Collection();

    this.rateLimiter = new RateLimiter();
    this.dbService = new DatabaseService();
    this.aiService = new AIService();
  }

  async initialize() {
    console.log("🔵 Starting Gojo Satoru Discord Bot...");

    // Services initialization
    await this.dbService.initialize();

    // Event handlers setup
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
      readyClient.user.setActivity(
        "Throughout Heaven & Earth, I Alone am the Honored One",
        {
          type: ActivityType.Playing,
        }
      );
    });

    this.client.on(Events.MessageCreate, (message) => {
      handleMessage(
        message,
        this.client,
        this.rateLimiter,
        this.dbService,
        this.aiService
      );
    });

    this.client.on(Events.MessageDelete, (message) => {
      if (message.author?.bot || !message.guild) return;
      this.client.snipes.set(message.channel.id, {
        content: message.content || "No text content",
        author: message.author,
        image: message.attachments.first()?.proxyURL || null,
        timestamp: Date.now(),
      });
    });

    this.client.on(Events.Error, (error) => {
      console.error("❌ Discord client error:", error);
    });
  }

  async start() {
    if (!CONFIG.BOT_TOKEN) {
      throw new Error(
        "❌ DISCORD_TOKEN is required in environment variables. Bot cannot start."
      );
    }
    await this.client.login(CONFIG.BOT_TOKEN);
  }

  async shutdown() {
    console.log("🔵 Shutting down bot...");

    try {
      if (this.client && this.client.readyAt) {
        this.client.destroy();
        console.log("🔌 Discord client disconnected.");
      }

      await this.dbService.close();
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    } finally {
      console.log("👋 Bot has shut down.");
      process.exit(0);
    }
  }
}
