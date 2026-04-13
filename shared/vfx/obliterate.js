import { playFinishingEffect } from "./finishing.js";

export async function playObliterateEffect(championEl) {
  return playFinishingEffect(championEl, { variant: "obliterate" });
}
