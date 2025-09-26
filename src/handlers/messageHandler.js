// src/handlers/messageHandler.js

import { CONFIG, DOMAIN_EXPANSION_GIF_PATH } from "../config/config.js";
import { generateGojoPersona, isSpecialUser } from "../ai/persona.js";
import { getOfflineResponse, getFallbackResponse } from "../utils/helpers.js";
import { handleSearchCommand } from "../commands/searchCommand.js";
import { handleValorantCommand } from "../commands/valorantCommand.js";
import { handleSnipeCommand } from "../commands/snipeCommand.js";
import { handleRussianRoulette } from "../commands/rouletteCommand.js";

export async function handleMessage(
  message,
  client,
  rateLimiter,
  dbService,
  aiService
) {
  if (message.author.bot) return;

  // This logic for detecting a command is perfect and remains unchanged.
  let commandContent = null;
  const isMentioned = message.mentions.has(client.user.id);
  const isReplyToBot =
    message.reference &&
    message.channel.messages.cache.get(message.reference.messageId)?.author
      .id === client.user.id;

  if (message.content.startsWith(CONFIG.PREFIX)) {
    commandContent = message.content.slice(CONFIG.PREFIX.length).trim();
  } else if (isMentioned) {
    commandContent = message.content.replace(/<@!?\d+>/g, "").trim();
  } else if (isReplyToBot) {
    commandContent = message.content.trim();
  }

  if (!commandContent) return;

  const lowerContent = commandContent.toLowerCase();

  // Your command routing for Valorant, Search, etc., is perfect and remains unchanged.
  // ... (val, google, domain expansion command blocks go here) ...
  if (lowerContent.startsWith("val") || lowerContent.startsWith("valorant")) {
    const query = commandContent
      .slice(lowerContent.startsWith("val") ? 3 : 8)
      .trim();
    if (!query.includes("#"))
      return message.reply("❌ Use the format: `val YourName#Tag`");
    const [riotId, tag] = query.split("#").map((s) => s.trim());
    return handleValorantCommand(message, riotId, tag, aiService);
  }

  if (
    lowerContent.startsWith("sixeyes") ||
    lowerContent.startsWith("six eyes")
  ) {
    const snipe = client.snipes.get(message.channel.id);

    if (!snipe) {
      return message.reply("six eyes more like fraud");
    }

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setAuthor({
        name: snipe.author.tag,
        iconURL: snipe.author.displayAvatarURL(),
      })
      .setDescription(snipe.content)
      .setTimestamp(snipe.timestamp);

    if (snipe.image) {
      embed.setImage(snipe.image);
    }

    return message.reply({ embeds: [embed] });
  }

  if (lowerContent.startsWith("google") || lowerContent.startsWith("search")) {
    const query = commandContent
      .slice(lowerContent.startsWith("google") ? 6 : 6)
      .trim();
    if (!query) return message.reply("❌ Search for what? You gotta tell me.");
    return handleSearchCommand(
      message,
      query,
      aiService,
      generateGojoPersona,
      getFallbackResponse
    );
  }
  if (
    lowerContent.startsWith("roulette") ||
    lowerContent.startsWith("russian roulette")
  ) {
    // Just call the function you created!
    await handleRussianRoulette(message);
  }
  if (
    ["domain expansion", "infinite void", "ryoiki tenkai"].some((cmd) =>
      lowerContent.includes(cmd)
    )
  ) {
    // This command is unchanged.
    try {
      await message.reply({
        content: `${message.author} unleashes their Domain Expansion... **Unlimited Void**.`,
        files: [DOMAIN_EXPANSION_GIF_PATH],
      });

      const everyoneRole = message.guild.roles.cache.find(
        (r) => r.name === "@everyone"
      );
      await message.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
      });

      setTimeout(async () => {
        await message.channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: true,
        });
        await message.channel.send("Domain released.");
      }, 10000);
    } catch (e) {}
    return;
  }

  // ===== Default AI Chat Fallback =====
  try {
    // Your rate limiting logic is perfect and remains unchanged.
    const userCooldown = rateLimiter.checkUserCooldown(
      message.author.id,
      CONFIG.REQUEST_COOLDOWN
    );
    if (userCooldown > 0)
      return message.reply(`⏳ Wait ${userCooldown} more seconds.`);
    if (rateLimiter.isQuotaExhausted()) {
      const { isSukuna, isSuguru } = isSpecialUser(message);
      return message.reply(
        getOfflineResponse(isSukuna, isSuguru, message.author.username)
      );
    }
    await message.channel.sendTyping();
    rateLimiter.updateCooldowns(message.author.id);

    // ==========================================================
    // <<< THE FULLY IMPLEMENTED FIX >>>
    // ==========================================================

    // Step 1: Check who the user is and get their name.
    const { isSukuna, isSuguru } = isSpecialUser(message);
    const username = message.author.username;

    // Step 2: Create the explicit Mission Briefing (Persona) which tells the bot EXACTLY who it is talking to.
    const systemInstruction = generateGojoPersona(isSukuna, isSuguru, username);

    // Step 3: Get the history of the conversation CONTENT.
    const rawHistory = await dbService.getConversationHistory(
      message.channel.id
    );

    // Step 4 (FIXED): The history now ONLY contains the message content. The `role`
    // property tells the AI the sequence, we don't show it the "username:" format.
    const formattedHistory = rawHistory.map((msg) => ({
      role: msg.author.isBot ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Step 5 (FIXED): We send the AI the raw user message and the critical Mission Briefing.
    // The AI now knows who is talking because the systemInstruction tells it.
    const aiResult = await aiService.generateResponse(
      commandContent, // Just the message content
      formattedHistory,
      systemInstruction // The Mission Briefing with the user's identity
    );

    // ==========================================================

    // Your logic for sending the response and saving to the DB is perfect and unchanged.
    if (!aiResult || !aiResult.response) {
      const offline = getOfflineResponse(isSukuna, isSuguru);
      return message.reply(offline);
    }

    const finalResponse = getFallbackResponse(
      aiResult.response,
      isSukuna,
      CONFIG.MAX_RESPONSE_LENGTH
    );
    await message.reply(finalResponse);

    await dbService.storeMessage(
      message,
      commandContent,
      true,
      aiResult.shouldRemember
    );
    await dbService.storeBotResponse(message, finalResponse, client.user);
  } catch (error) {
    console.error("Error in message handler:", error);
    message.reply("⚠️ Something went wrong. My Six Eyes are glitching.");
  }
}
