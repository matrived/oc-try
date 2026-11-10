---
name: ocr-reader
description: "Read text from images (receipts, screenshots, documents) via the local llama-server multimodal endpoint."
metadata:
  openclaw:
    emoji: "🔍"
    requires:
      bins: ["base64", "curl"]
---

# OCR Reader

Extract text from images using the local `llama-server` with vision support.

## When to use

- User wants text from an image (receipt, screenshot, document, photo)
- User uploads or references an image file
- User asks to "read", "extract text from", or "OCR" an image

## Workflow

1. **Get the image path** — check workspace first, ask user to upload if not found
2. **Convert to base64:** `base64 -w 0 /path/to/image.jpg`
3. **Send to llama-server** with the prompt and image in one curl call:

```bash
IMG="/workspace/sample-receipt-photo.jpg"
PROMPT="What text is on this image? Transcribe everything you see."
B64=$(base64 -w 0 "$IMG")
curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ***" \
  -d "{
    \"model\": \"/models/unsloth-Qwen3.6-35B-A3B-GGUF/Qwen3.6-35B-A3B-UD-Q6_K.gguf\",
    \"messages\": [{\"role\":\"user\",\"content\":[
      {\"type\":\"text\",\"text\":\"$PROMPT\"},
      {\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/jpeg;base64,$B64\"}}
    ]}],
    \"max_tokens\": 4096,
    \"stream\": false
  }" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).choices[0].message.content))"
```

## Key rules

- The `image_url` MUST use `data:image/jpeg;base64,...` format — this is what triggers the vision encoder
- Text and image go in separate `type` blocks inside the `content` array
- Default prompt: `"What text is on this image? Transcribe everything you see exactly as it appears."`
- Use specific prompts for extraction: `"List all line items with prices"` or `"Extract just the total amount"`
- Warn user before running — CPU inference on this model takes ~2-5 minutes

## Prerequisites

- `llama-server` running on `localhost:8080` with `--mmproj` loaded
- Verify: `curl -s http://localhost:8080/v1/models | grep multimodal`
