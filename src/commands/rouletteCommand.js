import { EmbedBuilder, PermissionsBitField } from "discord.js";
import { CONFIG, ROULETTE_GIF_PATH } from "../config/config.js";
import path from "path";

// Helper function for creating a delay
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handles the Russian Roulette game logic.
 * @param {import("discord.js").Message} message The Discord message object that triggered the command.
 */
export async function handleRussianRoulette(message) {
  // --- PERMISSION CHECKS (You should add these back in!) ---

  // --- SETUP THE GAME ---
  const gifFileName = path.basename(ROULETTE_GIF_PATH);
  const embed = new EmbedBuilder()
    .setTitle("🔫 Russian Roulette")
    .setColor("Red")
    .setDescription("The cylinder is spinning...May fate be with you")
    .setImage(`attachment://${gifFileName}`);

  // ✅ FIX: Added the `files` property to attach the GIF
  const gameMessage = await message.channel.send({
    embeds: [embed],
    files: [ROULETTE_GIF_PATH],
  });

  // --- COUNTDOWN ---
  for (let i = 5; i > 0; i--) {
    await wait(1200);
    embed.setDescription(`The cylinder is spinning... **${i}**`);
    await gameMessage.edit({ embeds: [embed] });
  }

  await wait(1500);

  // --- SELECT THE VICTIM ---
  const participants = message.channel.members.filter(
    (member) => !member.user.bot
  );
  if (participants.size < 1) {
    embed.setDescription("Looks like there is no one to play with...");
    return gameMessage.edit({ embeds: [embed] });
  }

  const victim = participants.random();

  // --- THE ACTION ---
  try {
    await victim.roles.add(CONFIG.SHOT_USER_ROLE, "We have a victim");
    embed.setDescription(`💥 **BANG!**\n\n${victim} has been shot.`);
    await gameMessage.edit({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to timeout member:", error);
    embed.setDescription(
      `\n\n**...CLICK!** \n\n${victim}....the gun is jammed.`
    );
    await gameMessage.edit({ embeds: [embed] });
  }
}
