// File: src/config/config.js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();
export const CONFIG = {
  MODEL: "gemini-2.5-flash-lite",
  FALLBACK_MODEL: "gemini-2.0-flash-lite",
  API_KEY: process.env.API_KEY,
  BOT_TOKEN: process.env.BOT_TOKEN,
  PREFIX: "~gojo",
  MONGODB_URI: process.env.MONGODB_URI,
  DB_NAME: "gojojs",
  COLLECTION_NAME: "history",
  SUKUNA_USER_ID: process.env.SUKUNA_USER_ID || "yvestalone",
  SUGURU_USER_ID: process.env.SUGURU_USER_ID || "enceladus1337x",
  MAX_CONTEXT_TOKENS: 2000,
  MAX_RESPONSE_LENGTH: 800,
  REQUEST_COOLDOWN: 3000,
  GLOBAL_COOLDOWN: 1000,
  MAX_RETRIES: 2,
  RETRY_DELAY: 5000,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CX: process.env.GOOGLE_CX,
  TRACKER_API_KEY: process.env.TRACKER_API_KEY,
  MAX_SEARCH_RESULTS: 4,
  SHOT_USER_ROLE: process.env.SHOT_USER_ROLE,
};

// Define the local file path to your GIF
export const DOMAIN_EXPANSION_GIF_PATH = path.join(
  __dirname,
  "../../public/images/void.gif"
);
export const ROULETTE_GIF_PATH = path.join(
  __dirname,
  "../../public/images/roulette.gif"
);

export const MURASAKI_GIF_PATH = path.resolve(
  rootDir,
  "public",
  "images",
  "purple.gif"
);
