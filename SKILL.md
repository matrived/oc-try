name: ocr-reader
description: "Read text from images (receipts, screenshots, documents) using the FW-Muse-Glimmer-30B vision model on the Azure APIM endpoint."
metadata:
  openclaw:
    emoji: "🔍"
    requires:
      bins: ["curl", "python3"]
---

# OCR Reader

Extract text from images by sending them to `FW-Muse-Glimmer-30B` on the Azure APIM
gateway (OpenAI-compatible chat completions API with image input).

## When to use

- User wants text from an image (receipt, screenshot, document, photo)
- User uploads or references an image file
- User asks to "read", "extract text from", or "OCR" an image

## Workflow

1. **Find the image**: check the path the user gave, then the workspace. If not found, ask the user to upload it.
2. **Run this single command**, with IMG and PROMPT set for the task:

```bash
IMG="/workspace/sample-receipt-photo.jpg"
PROMPT="What text is on this image? Transcribe everything you see exactly as it appears."
MODEL="FW-Muse-Glimmer-30B"
REQ=$(mktemp)
python3 - "$IMG" "$PROMPT" "$MODEL" > "$REQ" <<'EOF'
import base64, json, mimetypes, sys
img, prompt, model = sys.argv[1:4]
mime = mimetypes.guess_type(img)[0] or "image/jpeg"
b64 = base64.b64encode(open(img, "rb").read()).decode()
print(json.dumps({"model": model, "max_tokens": 4096, "stream": False,
  "messages": [{"role": "user", "content": [
    {"type": "text", "text": prompt},
    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]}]}))
EOF
curl -sS -m 300 "${OPENAI_BASE_URL%/}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "api-key: $OPENAI_API_KEY" \
  --data-binary @"$REQ" \
| python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["choices"][0]["message"]["content"] if "choices" in d else d)'
rm -f "$REQ"
```

3. **Return the transcription** to the user as-is. Only summarise or reformat if the user asked for that.

## Key rules

- Auth is the `api-key` header. Never use `Authorization: Bearer`; APIM rejects it with 401.
- Never print, echo, or write `$OPENAI_API_KEY` anywhere.
- The image is sent as a `data:<mime>;base64,...` URL in its own `image_url` block; the instruction goes in a separate `text` block.
- The JSON body goes through a temp file (`--data-binary @file`), because large images exceed the shell's argument length limit.
- Use specific prompts for extraction tasks:
  - `"List all line items with their prices"`
  - `"Extract just the total amount"`
  - `"Return the text as a markdown table"`
- A response usually takes 3–15 seconds (remote API).

## Troubleshooting

| Output | Meaning |
|---|---|
| `statusCode 401` / "missing subscription key" | `OPENAI_API_KEY` is empty in the gateway's environment |
| `DeploymentNotFound` | Model name is wrong; it must be exactly `FW-Muse-Glimmer-30B` |
| `No such file or directory` | Wrong image path |
| Very small or blurry image gives vague output | Ask the user for a larger or clearer image |

## Prerequisites

- `OPENAI_BASE_URL` and `OPENAI_API_KEY` exported in the environment the gateway was started from
- Verify: `echo ${#OPENAI_API_KEY}` prints `32`