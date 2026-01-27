import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const ocrModel = process.env.OCR_MODEL || "deepseek-ocr";
const jsonModel = process.env.JSON_MODEL || "gpt-oss:120b-cloud";
const maxPages = Number(process.env.MAX_PAGES || 25);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 60000);
const ocrTimeoutMs = Number(process.env.OCR_TIMEOUT_MS || requestTimeoutMs);
const jsonTimeoutMs = Number(process.env.JSON_TIMEOUT_MS || 120000);
const pdfRenderScale = Number(process.env.PDF_RENDER_SCALE || 2.5);
const pdfEnhance = (process.env.PDF_ENHANCE || "true").toLowerCase() === "true";
const pdfEnhanceMode = process.env.PDF_ENHANCE_MODE || "contrast";
const pdfEnhanceContrast = Number(process.env.PDF_ENHANCE_CONTRAST || 1.15);
const pdfEnhanceThreshold = Number(process.env.PDF_ENHANCE_THRESHOLD || 200);

app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));
app.use("/vendor/pdfjs", express.static("node_modules/pdfjs-dist"));

app.get("/api/config", (req, res) => {
  res.json({
    ocrModel,
    jsonModel,
    maxPages,
    pdfRenderScale,
    pdfEnhance,
    pdfEnhanceMode,
    pdfEnhanceContrast,
    pdfEnhanceThreshold,
  });
});

app.post("/api/ocr", async (req, res) => {
  const { imageBase64 } = req.body || {};
  if (!imageBase64) {
    console.error("[OCR Error] Missing imageBase64 in request body");
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ocrTimeoutMs);

    console.log(
      `[OCR Request] Starting OCR request to ${ollamaBaseUrl}/api/chat with model: ${ocrModel}`,
    );
    console.log(
      `[OCR Request] Image base64 length: ${imageBase64.length} characters`,
    );

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ocrModel,
        messages: [
          {
            role: "user",
            content: "Free OCR.",
            images: [imageBase64],
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await safeReadText(response);
      console.error(
        `[OCR Error] Ollama request failed with status: ${response.status}`,
      );
      console.error(`[OCR Error] Response detail: ${detail}`);
      console.error(`[OCR Error] Request URL: ${ollamaBaseUrl}/api/chat`);
      console.error(`[OCR Error] Model used: ${ocrModel}`);
      return res.status(response.status).json({
        error: "Ollama OCR request failed",
        detail,
      });
    }

    const data = await response.json();
    const text = data?.message?.content || "";

    console.log(
      `[OCR Success] OCR completed successfully, extracted text length: ${text.length} characters`,
    );
    return res.json({ text });
  } catch (error) {
    console.error(
      `[OCR Error] Exception during OCR request: ${error?.message || String(error)}`,
    );
    console.error(
      `[OCR Error] Request details: URL=${ollamaBaseUrl}/api/chat, Model=${ocrModel}`,
    );
    console.error(
      `[OCR Error] Timeout settings: OCR_TIMEOUT_MS=${ocrTimeoutMs}`,
    );
    if (error.name === "AbortError") {
      console.error(
        `[OCR Error] Request was aborted due to timeout after ${ocrTimeoutMs}ms`,
      );
    }
    return res.status(500).json({
      error: "OCR request error",
      detail: error?.message || String(error),
    });
  }
});

app.post("/api/convert", async (req, res) => {
  const { text, systemPrompt, userPrompt } = req.body || {};
  if (!text) {
    console.error("[JSON Error] Missing text in request body");
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), jsonTimeoutMs);

    console.log(
      `[JSON Request] Starting JSON conversion request to ${ollamaBaseUrl}/api/chat with model: ${jsonModel}`,
    );
    console.log(`[JSON Request] Text length: ${text.length} characters`);
    console.log(
      `[JSON Request] System prompt: ${systemPrompt ? "Provided" : "Not provided"}`,
    );
    console.log(
      `[JSON Request] User prompt: ${userPrompt ? "Provided" : "Not provided"}`,
    );

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: jsonModel,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          {
            role: "user",
            content: userPrompt ? userPrompt.replace("{{text}}", text) : text,
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await safeReadText(response);
      console.error(
        `[JSON Error] Ollama request failed with status: ${response.status}`,
      );
      console.error(`[JSON Error] Response detail: ${detail}`);
      console.error(`[JSON Error] Request URL: ${ollamaBaseUrl}/api/chat`);
      console.error(`[JSON Error] Model used: ${jsonModel}`);
      console.error(`[JSON Error] Text length: ${text.length} characters`);
      return res.status(response.status).json({
        error: "JSON conversion request failed",
        detail,
      });
    }

    const data = await response.json();
    const content = data?.message?.content || "";

    console.log(
      `[JSON Success] JSON conversion completed successfully, output length: ${content.length} characters`,
    );

    return res.json({ content });
  } catch (error) {
    console.error(
      `[JSON Error] Exception during JSON conversion request: ${error?.message || String(error)}`,
    );
    console.error(
      `[JSON Error] Request details: URL=${ollamaBaseUrl}/api/chat, Model=${jsonModel}`,
    );
    console.error(`[JSON Error] Text length: ${text.length} characters`);
    console.error(
      `[JSON Error] Timeout settings: JSON_TIMEOUT_MS=${jsonTimeoutMs}`,
    );
    if (error.name === "AbortError") {
      console.error(
        `[JSON Error] Request was aborted due to timeout after ${jsonTimeoutMs}ms`,
      );
    }
    return res.status(500).json({
      error: "JSON conversion error",
      detail: error?.message || String(error),
    });
  }
});

app.listen(port, () => {
  console.log(
    `[Server] DeepSeek OCR Studio server running at http://localhost:${port}`,
  );
  console.log(`[Server] Configuration:`);
  console.log(`[Server]   Ollama Base URL: ${ollamaBaseUrl}`);
  console.log(`[Server]   OCR Model: ${ocrModel}`);
  console.log(`[Server]   JSON Model: ${jsonModel}`);
  console.log(`[Server]   Max Pages: ${maxPages}`);
  console.log(`[Server]   OCR Timeout: ${ocrTimeoutMs}ms`);
  console.log(`[Server]   JSON Timeout: ${jsonTimeoutMs}ms`);
  console.log(`[Server]   PDF Render Scale: ${pdfRenderScale}`);
  console.log(
    `[Server]   PDF Enhancement: ${pdfEnhance} (mode: ${pdfEnhanceMode})`,
  );
});

async function safeReadText(response) {
  try {
    const text = await response.text();
    console.log(
      `[SafeReadText] Successfully read response text, length: ${text.length} characters`,
    );
    return text;
  } catch (error) {
    console.error(
      `[SafeReadText] Failed to read response text: ${error?.message || String(error)}`,
    );
    return "";
  }
}
