// src/handlers/messageHandler.js
import { EmbedBuilder, PermissionsBitField } from "discord.js";
import {
  CONFIG,
  DOMAIN_EXPANSION_GIF_PATH,
  MURASAKI_GIF_PATH,
  WSLASH_GIF_PATH,
} from "../config/config.js";
import { generateGojoPersona, isSpecialUser } from "../ai/persona.js";
import { getOfflineResponse, getFallbackResponse } from "../utils/helpers.js";
import { handleSearchCommand } from "../commands/searchCommand.js";
import { handleValorantCommand } from "../commands/valorantCommand.js";
import { handleRussianRoulette } from "../commands/rouletteCommand.js";
import path from "path";

// ─── WORLD CUTTING SLASH — CHANT STATE ────────────────────────────────────────
const YVESTALONE_USERNAME = "yvestalone"; // 🔁 Replace with your Discord username

// Key: `${username}-${channelId}` → { chants: number }
const chantSessions = new Map();

// ─── DELETE ALL MESSAGES FROM A USER (INCLUDING OLDER THAN 14 DAYS) ───────────
async function deleteUserMessages(channel, targetUser, limit = null) {
  let deleted = 0;
  let lastId;
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

  // Check if bot can view and manage messages in this channel
  if (
    !channel
      .permissionsFor(channel.guild.members.me)
      .has(PermissionsBitField.Flags.ViewChannel) ||
    !channel
      .permissionsFor(channel.guild.members.me)
      .has(PermissionsBitField.Flags.ManageMessages)
  ) {
    console.log(`Skipping channel ${channel.name}: insufficient permissions.`);
    return 0;
  }

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    let batch;
    try {
      batch = await channel.messages.fetch(options);
    } catch (error) {
      console.error(`Failed to fetch messages in ${channel.name}:`, error);
      break;
    }

    if (!batch.size) break;

    // Filter messages by target user
    let targets = [...batch.values()].filter(
      (m) => m.author.id === targetUser.id,
    );

    if (limit !== null) targets = targets.slice(0, limit - deleted);

    if (targets.length) {
      // Split: fresh ones can be bulk-deleted, old ones must be deleted one-by-one
      const fresh = targets.filter(
        (m) => Date.now() - m.createdTimestamp < FOURTEEN_DAYS,
      );
      const old = targets.filter(
        (m) => Date.now() - m.createdTimestamp >= FOURTEEN_DAYS,
      );

      // Bulk delete fresh messages
      if (fresh.length === 1) {
        try {
          await fresh[0].delete();
          deleted += 1;
        } catch (error) {
          console.error(
            `Failed to delete fresh message in ${channel.name}:`,
            error,
          );
        }
      } else if (fresh.length > 1) {
        try {
          await channel.bulkDelete(fresh, true);
          deleted += fresh.length;
        } catch (error) {
          console.error(`Failed to bulk delete in ${channel.name}:`, error);
        }
      }

      // Individually delete old messages with a longer delay to avoid rate limits
      for (const msg of old) {
        try {
          await msg.delete();
          deleted += 1;
          await new Promise((r) => setTimeout(r, 500));
        } catch (error) {
          console.error(
            `Failed to delete old message in ${channel.name}:`,
            error,
          );
        }
      }
    }

    if (limit !== null && deleted >= limit) break;

    // FIX 4: Only continue paginating if we got a full batch.
    // This avoids a redundant extra fetch on exact multiples of 100.
    if (batch.size < 100) break;

    lastId = batch.last().id;
  }

  return deleted;
}
// ──────────────────────────────────────────────────────────────────────────────

export async function handleMessage(
  message,
  client,
  rateLimiter,
  dbService,
  aiService,
) {
  if (message.author.bot) return;

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

  // ─── VALORANT ─────────────────────────────────────────────────────────────
  if (lowerContent.startsWith("val") || lowerContent.startsWith("valorant")) {
    const query = commandContent
      .slice(lowerContent.startsWith("val") ? 3 : 8)
      .trim();
    if (!query.includes("#"))
      return message.reply("❌ Use the format: `val YourName#Tag`");
    const [riotId, tag] = query.split("#").map((s) => s.trim());
    return handleValorantCommand(message, riotId, tag, aiService);
  }

  // ─── SIX EYES (SNIPE) ─────────────────────────────────────────────────────
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

  // ─── GOOGLE / SEARCH ──────────────────────────────────────────────────────
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
      getFallbackResponse,
    );
  }

  // ─── RUSSIAN ROULETTE ─────────────────────────────────────────────────────
  if (
    lowerContent.startsWith("roulette") ||
    lowerContent.startsWith("russian roulette")
  ) {
    try {
      await handleRussianRoulette(message);
    } catch (e) {}
    return;
  }

  // ─── DOMAIN EXPANSION ─────────────────────────────────────────────────────
  if (
    ["domain expansion", "infinite void", "ryoiki tenkai"].some((cmd) =>
      lowerContent.includes(cmd),
    )
  ) {
    try {
      await message.reply({
        content: `${message.author} unleashes their Domain Expansion... **Unlimited Void**.`,
        files: [DOMAIN_EXPANSION_GIF_PATH],
      });

      const everyoneRole = message.guild.roles.cache.find(
        (r) => r.name === "@everyone",
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

  // ─── HOLLOW PURPLE (MURASAKI) ─────────────────────────────────────────────
  if (
    lowerContent.startsWith("murasaki") ||
    lowerContent.startsWith("hollow purple")
  ) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return message.reply(
        "You think you're strong enough to command me? You need the 'Manage Messages' permission for that stunt.",
      );
    }
    if (
      !message.guild.members.me.permissions.has(
        PermissionsBitField.Flags.ManageMessages,
      )
    ) {
      return message.reply(
        "Hmph. I can't do that. Grant me the 'Manage Messages' permission first.",
      );
    }

    const args = commandContent.split(" ");
    const amountToDelete = parseInt(args[1]);

    if (isNaN(amountToDelete) || amountToDelete < 1 || amountToDelete > 99) {
      return message.reply(
        "You need to give me a number between 1 and 99, genius. `murasaki 10` for example.",
      );
    }

    try {
      await message.delete();

      const fetchedMessages = await message.channel.bulkDelete(
        amountToDelete,
        true,
      );

      if (fetchedMessages.size === 0) {
        const warning = await message.channel.send(
          "Couldn't find any recent messages to delete. They're probably older than 14 days.",
        );
        setTimeout(() => warning.delete().catch(() => {}), 7000);
        return;
      }

      const gifFileName = path.basename(MURASAKI_GIF_PATH);
      const embed = new EmbedBuilder()
        .setColor("#9370DB")
        .setTitle("Hollow Technique: Purple")
        .setDescription(
          `Imaginary mass has been erased. Obliterated **${fetchedMessages.size}** message(s).`,
        )
        .setImage(`attachment://${gifFileName}`)
        .setTimestamp();

      const reply = await message.channel.send({
        embeds: [embed],
        files: [MURASAKI_GIF_PATH],
      });

      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 13000);
    } catch (error) {
      console.error("Error in Murasaki command:", error);
      const errorMsg = await message.channel.send(
        "⚠️ **Gojo got stabbed by toji no hollow purple for you**",
      );
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
    }
    return;
  }

  // ─── WORLD CUTTING SLASH — 4-STEP CHANT ────────────────────────────────────
  const sessionKey = `${message.author.username}-${message.channel.id}`;

  // ── Chant 1: Scale of the Dragon ──
  if (lowerContent.includes("scale of the dragon")) {
    if (message.author.username !== YVESTALONE_USERNAME) return;

    chantSessions.set(sessionKey, { chants: 1 });
    try {
      await message.reply({
        content: `*${message.author} begins the incantation...*\n> **Scale of the Dragon!**`,
      });
    } catch (e) {}
    return;
  }

  // ── Chant 2: Recoil ──
  if (lowerContent.includes("recoil")) {
    if (message.author.username !== YVESTALONE_USERNAME) return;
    const session = chantSessions.get(sessionKey);
    if (!session || session.chants !== 1) return;

    chantSessions.set(sessionKey, { chants: 2 });
    try {
      await message.reply({
        content: `*The air twists and warps...*\n> **Recoil!**`,
      });
    } catch (e) {}
    return;
  }

  // ── Chant 3: Twin Meteors ──
  if (lowerContent.includes("twin meteors")) {
    if (message.author.username !== YVESTALONE_USERNAME) return;
    const session = chantSessions.get(sessionKey);
    if (!session || session.chants !== 2) return;

    chantSessions.set(sessionKey, { chants: 3 });
    try {
      await message.reply({
        content: `*The sky splits apart...*\n> **Twin Meteors!**`,
      });
    } catch (e) {}
    return;
  }

  // ── Final Strike: World Cutting Slash @user ──
  if (lowerContent.includes("world cutting slash")) {
    if (message.author.username !== YVESTALONE_USERNAME) return;

    const session = chantSessions.get(sessionKey);
    const chantCount = session?.chants ?? 0;

    if (chantCount === 0) {
      await message.reply(
        "You haven't chanted anything. Start with **Scale of the Dragon**.",
      );
      return;
    }

    // FIX 1: Filter out the bot from mentions so @Gojo invocations don't
    // accidentally pick the bot itself as the target instead of the real user.
    const targetUser = message.mentions.users
      .filter((u) => u.id !== client.user.id)
      .first();

    if (!targetUser) {
      await message.reply(
        "You need to mention someone — `world cutting slash @user`",
      );
      return;
    }

    chantSessions.delete(sessionKey);

    try {
      await message.reply({
        content: `${message.author} cuts everything in path and beyond...\n> **World Cutting Slash!**`,
        files: [WSLASH_GIF_PATH],
      });

      let deletedCount = 0;

      if (chantCount === 1) {
        // 1 chant — delete last 50 messages from current channel only
        deletedCount = await deleteUserMessages(
          message.channel,
          targetUser,
          50,
        );
        await message.channel.send(
          `Erased **${deletedCount}** message(s) from ${targetUser}.`,
        );
      } else if (chantCount === 2) {
        // 2 chants — delete last 100 messages from current channel only
        deletedCount = await deleteUserMessages(
          message.channel,
          targetUser,
          100,
        );
        await message.channel.send(
          `Erased **${deletedCount}** message(s) from ${targetUser}.`,
        );
      } else {
        // 3 chants — erase EVERY message from EVERY channel in the server.
        // FIX 2: Exclude thread channels — isTextBased() returns true for
        // threads too, but they have a different permission structure and
        // can cause errors during bulk deletion.
        const textChannels = message.guild.channels.cache.filter(
          (c) =>
            c.isTextBased() &&
            !c.isThread() &&
            c
              .permissionsFor(message.guild.members.me)
              .has(PermissionsBitField.Flags.ManageMessages) &&
            c
              .permissionsFor(message.guild.members.me)
              .has(PermissionsBitField.Flags.ViewChannel),
        );

        await message.channel.send(
          `Initiating full erasure of **${targetUser.username}** across **${textChannels.size}** channel(s)...`,
        );

        // FIX 3: Send a per-channel progress update so the server can see
        // the sweep is still running instead of silently hanging.
        for (const [, channel] of textChannels) {
          try {
            const count = await deleteUserMessages(channel, targetUser, null);
            deletedCount += count;
            if (count > 0) {
              await message.channel.send(
                `↳ Erased **${count}** message(s) in <#${channel.id}>`,
              );
            }
            console.log(
              `Deleted ${count} messages from ${targetUser.username} in #${channel.name}`,
            );
          } catch (e) {
            console.error(
              `[world cutting slash] failed in #${channel.name}:`,
              e,
            );
          }
        }

        await message.channel.send(
          `${targetUser.username} has been **erased from existence**. **${deletedCount}** message(s) deleted across all channels.`,
        );
      }
    } catch (e) {
      console.error("[world cutting slash]", e);
    }
    return;
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ===== Default AI Chat Fallback =====
  try {
    const userCooldown = rateLimiter.checkUserCooldown(
      message.author.id,
      CONFIG.REQUEST_COOLDOWN,
    );
    if (userCooldown > 0)
      return message.reply(`⏳ Wait ${userCooldown} more seconds.`);

    if (rateLimiter.isQuotaExhausted()) {
      const { isSukuna, isSuguru } = isSpecialUser(message);
      return message.reply(
        getOfflineResponse(isSukuna, isSuguru, message.author.username),
      );
    }

    await message.channel.sendTyping();
    rateLimiter.updateCooldowns(message.author.id);

    const { isSukuna, isSuguru } = isSpecialUser(message);
    const username = message.author.username;

    const systemInstruction = generateGojoPersona(isSukuna, isSuguru, username);

    const rawHistory = await dbService.getConversationHistory(
      message.channel.id,
    );

    const formattedHistory = rawHistory.map((msg) => ({
      role: msg.author.isBot ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const aiResult = await aiService.generateResponse(
      commandContent,
      formattedHistory,
      systemInstruction,
    );

    if (!aiResult || !aiResult.response) {
      const offline = getOfflineResponse(isSukuna, isSuguru);
      return message.reply(offline);
    }

    const finalResponse = getFallbackResponse(
      aiResult.response,
      isSukuna,
      CONFIG.MAX_RESPONSE_LENGTH,
    );
    await message.reply(finalResponse);

    await dbService.storeMessage(
      message,
      commandContent,
      true,
      aiResult.shouldRemember,
    );
    await dbService.storeBotResponse(message, finalResponse, client.user);
  } catch (error) {
    console.error("Error in message handler:", error);
    message.reply("⚠️ Something went wrong. My Six Eyes are glitching.");
  }
}
