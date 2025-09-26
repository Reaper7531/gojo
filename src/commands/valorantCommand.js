// ===== VALORANT COMMAND HANDLER (commands/valorantCommand.js) =====
import fetch from "node-fetch";
import { CONFIG } from "../config/config.js";
import { EmbedBuilder } from "discord.js";

const API_BASE_URL = "https://api.henrikdev.xyz/valorant";
const USER_AGENT = "Gojo-Discord-Bot/1.0"; // Setting a User-Agent is good practice

/**
 * Sends a standardized error embed message.
 * @param {import("discord.js").Message} message The Discord message object.
 * @param {string} title The title of the error.
 * @param {string} description The description of the error.
 * @param {string} [footerText] Optional footer text.
 */
function sendErrorEmbed(
  message,
  title,
  description,
  footerText = "Please try again later"
) {
  const errorEmbed = new EmbedBuilder()
    .setColor("#FF6B6B")
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footerText });
  return message.reply({ embeds: [errorEmbed] });
}

/**
 * Determines the embed color based on the player's rank.
 * @param {string} rank The player's rank string.
 * @returns {string} A hex color code.
 */
function getRankColor(rank) {
  const lowerRank = rank.toLowerCase();
  if (lowerRank.includes("radiant")) return "#FFFF00";
  if (lowerRank.includes("immortal")) return "#B3234F";
  if (lowerRank.includes("ascendant")) return "#27A45B";
  if (lowerRank.includes("diamond")) return "#C387F6";
  if (lowerRank.includes("platinum")) return "#54A4B5";
  if (lowerRank.includes("gold")) return "#E8B852";
  if (lowerRank.includes("silver")) return "#C0C0C0";
  if (lowerRank.includes("bronze")) return "#A97142";
  return "#808080"; // Default for Iron/Unranked
}

/**
 * Handles the Valorant stats command.
 * @param {import("discord.js").Message} message The Discord message object.
 * @param {string} riotId The player's Riot ID.
 * @param {string} tag The player's tag.
 * @param {object} aiService The AI service instance for generating responses.
 */
export async function handleValorantCommand(message, riotId, tag, aiService) {
  const cleanRiotId = riotId.trim();
  const cleanTag = tag.trim();
  console.log(`🎯 Starting Valorant command for: ${cleanRiotId}#${cleanTag}`);

  await message.channel.sendTyping();

  if (!CONFIG.TRACKER_API_KEY) {
    console.error("❌ Tracker API key is missing from config");
    return sendErrorEmbed(
      message,
      "❌ Configuration Error",
      "My six eyes are on cooldown. The Valorant API key is missing.",
      "Contact the bot administrator"
    );
  }

  try {
    // ===== Step 1: Get the Player's UUID and Region (Sequential) =====
    console.log("📡 Step 1: Fetching account data...");
    const accountUrl = `${API_BASE_URL}/v2/account/${encodeURIComponent(
      cleanRiotId
    )}/${encodeURIComponent(cleanTag)}`;
    const accountResponse = await fetch(accountUrl, {
      headers: {
        Authorization: CONFIG.TRACKER_API_KEY,
        "User-Agent": USER_AGENT,
      },
    });

    if (!accountResponse.ok) {
      if (accountResponse.status === 404) {
        return sendErrorEmbed(
          message,
          "👤 Player Not Found",
          `My six eyes can't find **${cleanRiotId}#${cleanTag}**. Check for typos and try again.`,
          "Verify the Riot ID and tag are correct."
        );
      }
      return sendErrorEmbed(
        message,
        "❌ API Error",
        `The API returned a status of ${accountResponse.status} while fetching account data.`
      );
    }

    const accountData = await accountResponse.json();
    if (accountData.status !== 200 || !accountData.data) {
      return sendErrorEmbed(
        message,
        "❌ API Response Error",
        accountData.message || "Could not retrieve valid account data."
      );
    }

    const { puuid, region, name, tag: playerTag } = accountData.data;
    console.log(`✅ Found player: ${name}#${playerTag} | Region: ${region}`);

    // ===== Step 2: Fetch MMR and Match History (In Parallel) =====
    console.log("📡 Step 2: Fetching MMR and Match data in parallel...");
    const mmrUrl = `${API_BASE_URL}/v2/by-puuid/mmr/${region}/${puuid}`;
    const matchesUrl = `${API_BASE_URL}/v3/by-puuid/matches/${region}/${puuid}?filter=competitive&size=10`;

    const [mmrResult, matchesResult] = await Promise.allSettled([
      fetch(mmrUrl, {
        headers: {
          Authorization: CONFIG.TRACKER_API_KEY,
          "User-Agent": USER_AGENT,
        },
      }),
      fetch(matchesUrl, {
        headers: {
          Authorization: CONFIG.TRACKER_API_KEY,
          "User-Agent": USER_AGENT,
        },
      }),
    ]);

    // --- Process MMR Data ---
    let rank = "Unranked";
    let rr = 0;
    let rankTier = 0;
    if (mmrResult.status === "fulfilled" && mmrResult.value.ok) {
      const mmrData = await mmrResult.value.json();
      if (mmrData.status === 200 && mmrData.data?.current_data) {
        const { currenttierpatched, ranking_in_tier, currenttier } =
          mmrData.data.current_data;
        rank = currenttierpatched || "Unranked";
        rr = ranking_in_tier || 0;
        rankTier = currenttier || 0;
        if (rankTier >= 24) {
          // Tiers for Ascendant, Immortal, Radiant
          rank = `${rank} (${rr} RR)`;
        }
      }
    } else {
      console.warn("⚠️ Failed to fetch MMR data.");
    }
    console.log(`🏆 Player rank: ${rank}`);

    // --- Process Match Data (with Seasonal Filtering) ---
    let totalKills = 0,
      totalDeaths = 0,
      totalAssists = 0,
      wins = 0,
      seasonalMatchesCount = 0;

    if (matchesResult.status === "fulfilled" && matchesResult.value.ok) {
      const matchesData = await matchesResult.value.json();
      if (
        matchesData.status === 200 &&
        Array.isArray(matchesData.data) &&
        matchesData.data.length > 0
      ) {
        const firstValidMatch = matchesData.data.find(
          (match) => match.metadata?.season_id
        );

        if (!firstValidMatch) {
          console.warn(
            "⚠️ Could not determine current season ID from match history. Stats will be based on 0 matches."
          );
        } else {
          const currentSeasonId = firstValidMatch.metadata.season_id;
          console.log(`✅ Current Season ID identified: ${currentSeasonId}`);

          const seasonalMatches = matchesData.data.filter(
            (match) => match.metadata?.season_id === currentSeasonId
          );
          seasonalMatchesCount = seasonalMatches.length;

          for (const match of seasonalMatches) {
            const player = match.players.all_players.find(
              (p) => p.puuid === puuid
            );
            if (player?.stats) {
              totalKills += player.stats.kills;
              totalDeaths += player.stats.deaths;
              totalAssists += player.stats.assists;
              if (match.teams[player.team.toLowerCase()]?.has_won) {
                wins++;
              }
            }
          }
          console.log(
            `📈 Processed ${seasonalMatchesCount} matches for the current season.`
          );
        }
      }
    } else {
      console.warn(
        "⚠️ Failed to fetch match data or player has no recent competitive matches."
      );
    }

    // ===== Step 3: Calculate Final Stats =====
    const kda =
      totalDeaths > 0
        ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
        : totalKills.toFixed(2);
    const winRate =
      seasonalMatchesCount > 0
        ? ((wins / seasonalMatchesCount) * 100).toFixed(1)
        : "0";
    const losses = seasonalMatchesCount - wins;

    // ===== Step 4: Generate AI Summary =====
    console.log("🤖 Generating AI summary...");
    const summaryPrompt = `You're Satoru Gojo from Jujutsu Kaisen, analyzing a Valorant player. Be confident, slightly arrogant, but insightful. Use Gojo's personality.

Player Stats (Current Season, based on last ${seasonalMatchesCount} matches):
- Name: ${name}
- Rank: ${rank}
- Win/Loss: ${wins}W / ${losses}L
- KDA Ratio: ${kda}
- Win Rate: ${winRate}%

Give a short, confident analysis in Gojo's style. Don't just list stats. Keep it under 100 words and end with a signature Gojo comment.`;

    let generatedSummary = "My limitless technique is processing your stats...";
    try {
      if (!aiService) throw new Error("AI service not available.");

      // ================== FIX IMPLEMENTED HERE ==================
      // The AI service now returns an object like { response: "...", shouldRemember: false }.
      // We need to extract the 'response' property to get the string for the embed.
      const aiResult = await aiService.generateResponse(summaryPrompt, []);

      // Ensure aiResult is what we expect before trying to access properties
      if (typeof aiResult === "object" && aiResult.response) {
        generatedSummary = aiResult.response;
      } else if (typeof aiResult === "string") {
        // Handle cases where it might still return a string (older versions/fallbacks)
        generatedSummary = aiResult;
      }
      // ==========================================================
    } catch (aiError) {
      console.error(
        "❌ AI summarization failed, using fallback:",
        aiError.message
      );
      if (parseFloat(kda) >= 1.3 && parseFloat(winRate) >= 55) {
        generatedSummary =
          "Hoh? Not bad at all. You're dominating out there. My Six Eyes approve. 👁️⚡";
      } else if (parseFloat(kda) >= 1.0 && parseFloat(winRate) >= 48) {
        generatedSummary =
          "Decent. You're holding your own, but there's always room to reach my level. Don't get cocky. 😎";
      } else {
        generatedSummary =
          "Hmm, I see some potential. But you've got a ways to go before you're a real threat. Keep training. 💪";
      }
    }

    // ===== Step 5: Create and send response embed =====
    const trackerUrl = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(
      name
    )}%23${encodeURIComponent(playerTag)}/overview`;

    const statsEmbed = new EmbedBuilder()
      .setColor(getRankColor(rank))
      .setTitle(`📊 ${name}#${playerTag}`)
      .setURL(trackerUrl)
      .setDescription(generatedSummary) // This is line 270 (approx), now it receives a string
      .addFields(
        { name: "🏆 Current Rank", value: rank, inline: true },
        { name: "🎯 KDA Ratio", value: kda, inline: true },
        {
          name: "📈 Win Rate",
          value: `${winRate}% (${wins}W - ${losses}L)`,
          inline: true,
        },
        {
          name: "⚔️ K/D/A",
          value: `${totalKills}/${totalDeaths}/${totalAssists}`,
          inline: true,
        },
        {
          name: "🎮 Matches",
          value: seasonalMatchesCount.toString(),
          inline: true,
        },
        {
          name: "🔥 Avg Kills/Game",
          value:
            seasonalMatchesCount > 0
              ? (totalKills / seasonalMatchesCount).toFixed(1)
              : "0",
          inline: true,
        }
      )
      .setFooter({
        text: `Region: ${region.toUpperCase()} • Current season competitive stats`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    console.log("✅ Sending final response.");
    return message.reply({ embeds: [statsEmbed] });
  } catch (error) {
    console.error("💥 Critical Error in handleValorantCommand:", error);
    let errorMessage =
      "An unexpected error occurred. My limitless technique can't fix this one.";
    if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
      errorMessage = "Request timed out. The API is responding too slowly.";
    }
    return sendErrorEmbed(
      message,
      "💥 Critical Error",
      errorMessage,
      "If this persists, contact the administrator."
    );
  }
}
