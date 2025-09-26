import { EmbedBuilder, PermissionsBitField } from "discord.js";
import { ROULETTE_GIF_PATH } from "../config/config.js";

// Helper function for creating a delay
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handles the Russian Roulette game logic.
 * @param {Message} message The Discord message object that triggered the command.
 */
export async function handleRussianRoulette(message) {
  // --- PERMISSION CHECKS ---
  if (
    !message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)
  ) {
    return message.reply(
      "You don't have permission to start a game of Russian Roulette!"
    );
  }
  if (
    !message.guild.members.me.permissions.has(
      PermissionsBitField.Flags.ModerateMembers
    )
  ) {
    return message.reply(
      "I don't have the `Moderate Members` permission to time users out!"
    );
  }

  // --- SETUP THE GAME ---
  const gifUrl = ROULETTE_GIF_PATH;
  const embed = new EmbedBuilder()
    .setTitle("🔫 Russian Roulette")
    .setColor("Red")
    .setDescription("The cylinder is spinning...May fate be with you")
    .setImage(gifUrl);

  const gameMessage = await message.channel.send({ embeds: [embed] });

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
    await victim.timeout(60 * 1000, "**BANG!** has been shot 💥");
    embed.setDescription(`\n\n${victim} has been muted for 1 minute.`);
    await gameMessage.edit({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to timeout member:", error);
    embed.setDescription(`💥 **...CLICK!** \n\n${victim} the gun is jammed?!`);
    await gameMessage.edit({ embeds: [embed] });
  }
}
