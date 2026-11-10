#!/usr/bin/env node
// Minimal OCR helper — reads an image and calls the APIM (OpenAI-compatible) vision model
import fs from "node:fs";
import path from "node:path";

const base = (process.env.OPENAI_BASE_URL || "https://ignite2026-apim.azure-api.net/amd/openai/v1").replace(/\/+$/, "");
const url = `${base}/chat/completions`;
const model = process.env.OCR_MODEL || "FW-Muse-Glimmer-30B";
const apiKey = process.env.OPENAI_API_KEY;
const prompt = process.argv[2] || "What text is on this image? Transcribe everything you see exactly as it appears.";
const image = process.argv[3];

if (!apiKey) { console.error("ERROR: OPENAI_API_KEY is not set"); process.exit(1); }
if (!image || !fs.existsSync(image)) { console.error(`Usage: node ocr.mjs "<prompt>" <image-path>  (not found: ${image ?? "none"})`); process.exit(1); }

const mimes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const mime = mimes[path.extname(image).toLowerCase()] || "image/jpeg";
const b64 = fs.readFileSync(image).toString("base64");

const resp = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "api-key": apiKey },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }
    ]}],
    max_tokens: 4096, stream: false
  }),
  signal: AbortSignal.timeout(300000)
});

const raw = await resp.text();
let data;
try { data = JSON.parse(raw); } catch { console.error(`ERROR: HTTP ${resp.status}: ${raw.slice(0, 300)}`); process.exit(1); }
if (!resp.ok || !data.choices) {
  console.error(`ERROR: HTTP ${resp.status}: ${JSON.stringify(data.error ?? data).slice(0, 300)}`);
  process.exit(1);
}
console.log(data.choices[0].message.content ?? "");