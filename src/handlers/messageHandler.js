// src/handlers/messageHandler.js
import { EmbedBuilder, PermissionsBitField } from "discord.js";
import {
  CONFIG,
  DOMAIN_EXPANSION_GIF_PATH,
  MURASAKI_GIF_PATH,
} from "../config/config.js";
import { generateGojoPersona, isSpecialUser } from "../ai/persona.js";
import { getOfflineResponse, getFallbackResponse } from "../utils/helpers.js";
import { handleSearchCommand } from "../commands/searchCommand.js";
import { handleValorantCommand } from "../commands/valorantCommand.js";
import { handleRussianRoulette } from "../commands/rouletteCommand.js";
import path from "path";
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
    try {
      await handleRussianRoulette(message);
    } catch (e) {}
    return;
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

  if (
    lowerContent.startsWith("murasaki") ||
    lowerContent.startsWith("hollow purple")
  ) {
    // --- Permission Checks ---
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return message.reply(
        "You think you're strong enough to command me? You need the 'Manage Messages' permission for that stunt."
      );
    }
    if (
      !message.guild.members.me.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return message.reply(
        "Hmph. I can't do that. Grant me the 'Manage Messages' permission first."
      );
    }

    // --- Argument Parsing and Validation ---
    const args = commandContent.split(" ");
    const amountToDelete = parseInt(args[1]);

    if (isNaN(amountToDelete) || amountToDelete < 1 || amountToDelete > 99) {
      return message.reply(
        "You need to give me a number between 1 and 99, genius. `murasaki 10` for example."
      );
    }

    // ======================== NEW GRACEFUL LOGIC ========================
    try {
      // Step 1: Delete the user's command message IMMEDIATELY for instant feedback.
      await message.delete();

      // Step 2: Bulk delete the requested number of messages.
      // The `true` filter prevents it from crashing on messages older than 14 days.
      const fetchedMessages = await message.channel.bulkDelete(
        amountToDelete,
        true
      );

      // We check if any messages were actually deleted.
      if (fetchedMessages.size === 0) {
        const warning = await message.channel.send(
          "Couldn't find any recent messages to delete. They're probably older than 14 days."
        );
        setTimeout(() => warning.delete().catch(() => {}), 7000);
        return;
      }

      // Step 3: Send the final confirmation embed now that the work is done.
      const gifFileName = path.basename(MURASAKI_GIF_PATH);
      const embed = new EmbedBuilder()
        .setColor("#9370DB") // A nice purple color
        .setTitle("Hollow Technique: Purple")
        .setDescription(
          `Imaginary mass has been erased. Obliterated **${fetchedMessages.size}** message(s).`
        )
        .setImage(`attachment://${gifFileName}`)
        .setTimestamp();

      const reply = await message.channel.send({
        embeds: [embed],
        files: [MURASAKI_GIF_PATH],
      });

      // Step 4: Clean up the confirmation message after a delay.
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 13000); // 13 seconds
    } catch (error) {
      console.error("Error in Murasaki command:", error);
      // This error message will appear if the bot fails for other reasons (e.g., file permissions).
      const errorMsg = await message.channel.send(
        "⚠️ **Gojo got stabbed by toji no hollow purple for you**"
      );
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
    }
    return;
    // =====================================================================
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
