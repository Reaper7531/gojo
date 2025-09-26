// services/aiService.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "../config/config.js";

export class AIService {
  constructor() {
    if (!CONFIG.API_KEY) {
      throw new Error("API_KEY for Google AI is missing!");
    }
    this.ai = new GoogleGenerativeAI(CONFIG.API_KEY);
    this.currentModel = this.ai.getGenerativeModel({ model: CONFIG.MODEL });
  }

  async generateResponse(
    commandContent,
    chatHistory,
    systemInstruction,
    retryCount = 0
  ) {
    try {
      // Append the memory instruction to the main persona.
      const fullSystemInstruction =
        systemInstruction +
        `\n\nINSTRUCTION FOR MEMORY: At the very end of your response, after a new line, write ONLY [REMEMBER] or [FORGET]. ` +
        `[REMEMBER] means the user's message was important. ` +
        `[FORGET] means it was a mundane, normal message. This tag must be the absolute last thing you write.`;

      const chat = this.currentModel.startChat({
        history: chatHistory,
        systemInstruction: { parts: [{ text: fullSystemInstruction }] },
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.9,
          topP: 0.8,
        },
      });

      const result = await chat.sendMessage(commandContent);
      const fullText = result.response.text().trim();

      // Process the response to separate text from memory tag
      const shouldRemember = fullText.endsWith("[REMEMBER]");
      const responseText = fullText
        .replace(/\[REMEMBER\]|\[FORGET\]$/, "")
        .trim();

      return { response: responseText, shouldRemember: shouldRemember };
    } catch (error) {
      if (error.status === 429 && retryCount < CONFIG.MAX_RETRIES) {
        console.warn(
          `[AI Service] Quota exceeded. Retrying with fallback model... (Attempt ${
            retryCount + 1
          })`
        );

        // Switch to the fallback model
        this.currentModel = this.ai.getGenerativeModel({
          model: CONFIG.FALLBACK_MODEL,
        });

        await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY));

        return this.generateResponse(
          commandContent,
          chatHistory,
          systemInstruction,
          retryCount + 1
        );
      }

      console.error(
        "❌ An error occurred during AI response generation:",
        error
      );
      return { response: null, shouldRemember: false };
    }
  }
}
