// src/commands/searchCommand.js

import fetch from "node-fetch";
import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/config.js";

// ✨ OPTIMIZATION: Logic is broken down into smaller, single-purpose functions.

/**
 * Fetches search results from the Google Custom Search API.
 * @param {string} query The user's search query.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of search result items.
 * @throws {Error} Throws an error if the search fails or yields no results.
 */
async function fetchSearchResults(query) {
  const searchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${
    CONFIG.GOOGLE_API_KEY
  }&cx=${CONFIG.GOOGLE_CX}&q=${encodeURIComponent(query)}&num=${
    CONFIG.MAX_SEARCH_RESULTS
  }`;

  const response = await fetch(searchUrl);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || "Unknown Google API Error");
    error.status = response.status;
    throw error;
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("No results found for that query.");
  }

  return data.items;
}

/**
 * Handles various errors that can occur during the search process and replies to the user.
 * @param {Error} error The error object.
 * @param {import('discord.js').Message} message The Discord message object.
 */
async function handleSearchError(error, message) {
  console.error("An error occurred in the search command:", error);
  let reply =
    "My technique backfired. Something seriously went wrong with the search.";

  if (error.message.includes("No results found")) {
    reply =
      "Hmph. I looked everywhere with my Six Eyes and found nothing. Try asking something else.";
  } else if (error.status === 403) {
    reply =
      "My search technique is blocked. The Google API quota might be exceeded or the key is invalid.";
  } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
    reply = "Can't reach Google's servers. A temporary network issue, I guess.";
  } else if (error.name === "AbortError") {
    reply = "The search timed out. Too slow for me.";
  }

  await message.reply(`⚠️ ${reply}`);
}

/**
 * The main handler for the search command. Orchestrates the search and response.
 */
export async function handleSearchCommand(message, query, aiService) {
  await message.channel.sendTyping();

  if (!CONFIG.GOOGLE_API_KEY || !CONFIG.GOOGLE_CX) {
    return message.reply(
      "Can't use my Six Eyes for this. The Google API keys are missing. Boring."
    );
  }

  try {
    const searchResults = await fetchSearchResults(query);

    // ✨ OPTIMIZATION: Aggregate context and sources more cleanly.
    const searchContext = searchResults
      .map(
        (item, index) =>
          `[Source ${index + 1}]: Title: ${item.title}\nSnippet: ${
            item.snippet
          }`
      )
      .join("\n\n");

    const sourcesList = searchResults
      .map((item, index) => `[${index + 1}] **${item.title}**\n<${item.link}>`)
      .join("\n");

    // ✨ OPTIMIZATION: More precise and robust AI prompt.
    const gojoPersonaInstruction =
      "You are Gojo Satoru. Respond confidently, with your usual cocky, playful, and slightly arrogant attitude. Keep the final answer concise.";

    const summarizationPrompt = `
      Your mission is to provide a direct and synthesized answer to the user's query.
      Base your answer *exclusively* on the provided Search Results Context. Do not use any outside knowledge.
      Combine the information from all sources to form a single, complete answer.
      Do not mention the sources or "[Source X]" in your response. Just give the answer.

      User Query: "${query}"

      Search Results Context:
      ---
      ${searchContext}
      ---
      Now, provide the synthesized answer for the user's query.`;

    const { response: generatedText } = await aiService.generateResponse(
      summarizationPrompt,
      [], // No chat history is needed for this one-shot task.
      gojoPersonaInstruction
    );

    // ✨ OPTIMIZATION: Using Discord Embeds for a vastly improved UX.
    const embed = new EmbedBuilder()
      .setColor(0x7b68ee) // A nice purple-blue, like Gojo's eyes/technique
      .setTitle(`Here's what I found on "${query}"`)
      .setTimestamp()
      .setFooter({ text: "Powered by Six Eyes & Google" });

    if (generatedText) {
      embed.setDescription(generatedText);
    } else {
      // Fallback if AI fails to generate a response for any reason
      embed.setDescription(
        "Encountered problems during summary creation but here are the results"
      );
    }

    embed.addFields({
      name: "Sources I Glanced At",
      value: sourcesList || "No sources available.",
    });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    await handleSearchError(error, message);
  }
}
