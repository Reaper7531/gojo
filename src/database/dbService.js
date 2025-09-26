// database/dbService.js

import { MongoClient } from "mongodb";
import { CONFIG } from "../config/config.js";
import { approximateTokenCount } from "../utils/helpers.js";

export class DatabaseService {
  constructor() {
    this.mongoClient = new MongoClient(CONFIG.MONGODB_URI);
    this.dbCollection = null;
  }

  async initialize() {
    if (!CONFIG.MONGODB_URI) {
      console.warn(
        "MONGODB_URI is not configured. Bot will run without conversation memory."
      );
      return;
    }
    try {
      await this.mongoClient.connect();
      console.log("✅ Connected successfully to MongoDB");

      const db = this.mongoClient.db(CONFIG.DB_NAME);
      this.dbCollection = db.collection(CONFIG.COLLECTION_NAME);

      // Create an index for faster history retrieval
      await this.dbCollection.createIndex({ channelId: 1, timestamp: -1 });
      console.log("✅ Database collection and indexes are ready");
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      this.dbCollection = null; // Ensure collection is null on failure
    }
  }

  async storeMessage(
    message,
    content,
    isCommand = false,
    shouldRemember = false
  ) {
    if (!this.dbCollection || (!isCommand && !shouldRemember)) return;

    try {
      await this.dbCollection.insertOne({
        messageId: message.id,
        channelId: message.channel.id,
        guildId: message.guild?.id || "DM",
        timestamp: new Date(),
        author: {
          userId: message.author.id,
          username: message.author.username,
          isBot: message.author.bot,
        },
        content: content,
        tokenCount: approximateTokenCount(content),
        isCommand: isCommand,
      });
    } catch (error) {
      console.error(`Error storing user message ${message.id}:`, error);
    }
  }

  async storeBotResponse(originalMessage, responseText, clientUser) {
    if (!this.dbCollection) return;

    try {
      await this.dbCollection.insertOne({
        messageId: `bot_${originalMessage.id}`, // Create a unique-ish ID
        channelId: originalMessage.channel.id,
        guildId: originalMessage.guild?.id || "DM",
        timestamp: new Date(),
        author: {
          userId: clientUser.id,
          username: clientUser.username,
          isBot: true,
        },
        content: responseText,
        tokenCount: approximateTokenCount(responseText),
        isCommand: false, // Bot responses are not commands
      });
    } catch (error) {
      console.error("Error storing bot response:", error);
    }
  }

  async getConversationHistory(channelId) {
    if (!this.dbCollection) return [];

    try {
      const messages = await this.dbCollection
        .find({ channelId })
        .sort({ timestamp: -1 })
        .limit(20) // Limit initial DB query for performance
        .toArray();

      let currentTokenCount = 0;
      const historyToReturn = [];

      for (const msg of messages) {
        if (
          currentTokenCount + (msg.tokenCount || 0) >
          CONFIG.MAX_CONTEXT_TOKENS
        ) {
          break; // Stop if adding the next message exceeds the token limit
        }
        historyToReturn.push(msg);
        currentTokenCount += msg.tokenCount || 0;
      }

      return historyToReturn.reverse(); // Return in chronological order (oldest -> newest)
    } catch (error) {
      console.error("Error retrieving conversation history:", error);
      return [];
    }
  }

  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      console.log("MongoDB connection closed.");
    }
  }
}
