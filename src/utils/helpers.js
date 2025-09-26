// src/utils/helpers.js

/**
 * A simple approximation of token count based on character length.
 */
export const approximateTokenCount = (text) => Math.ceil(text.length / 4);

// Canned responses for when the AI service is offline or errors out.
export const OFFLINE_RESPONSES = {
  general: [
    "My limitless technique is recharging right now. Even I need a break sometimes.",
    "Tch, too many people want my attention. Come back later when I'm not so busy being the strongest.",
    "My six eyes are taking a power nap. Try again in a few minutes.",
    "Sorry, but even infinity has its limits... apparently. Give me a sec.",
  ],
  sukuna: [
    "Even the King of Curses has to wait when my power's recharging. How's that feel, Sukuna?",
    "Looks like you'll have to wait to get humiliated again. My technique is on a break.",
    "Not now, Sukuna. I'll deal with you later.",
  ],
  suguru: [
    "Sorry Suguru, even best friends have to wait sometimes. My limitless needs a moment.",
    "Give me a sec, besto friendo. Even my infinite power needs to recharge.",
    "Hold on Suguru, my six eyes are taking a quick break.",
  ],
};

/**
 * Gets a random offline/error response tailored to the user.
 * ✅ FIXED: Added 'export' keyword.
 */
export function getOfflineResponse(isSukuna, isSuguru) {
  let responses = OFFLINE_RESPONSES.general;

  if (isSukuna) {
    responses = OFFLINE_RESPONSES.sukuna;
  } else if (isSuguru) {
    responses = OFFLINE_RESPONSES.suguru;
  }

  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * A function to handle fallback responses or filter generated text.
 * ✅ FIXED: Added the missing function and 'export' keyword.
 */
export function getFallbackResponse(generatedText, isSukuna, maxLength) {
  if (!generatedText) {
    return "Huh? That doesn't make any sense to me. My Six Eyes must be blurry.";
  }

  if (
    generatedText.includes("Response was blocked due to SAFETY") ||
    generatedText.includes("I can't") ||
    generatedText.includes("I cannot")
  ) {
    return "Nah, not talking about that stuff. Too boring.";
  }

  if (generatedText.length > maxLength) {
    return generatedText.substring(0, maxLength - 3) + "...";
  }

  return generatedText;
}
