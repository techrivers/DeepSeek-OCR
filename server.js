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
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ocrTimeoutMs);

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
      return res.status(response.status).json({
        error: "Ollama OCR request failed",
        detail,
      });
    }

    const data = await response.json();
    const text = data?.message?.content || "";

    return res.json({ text });
  } catch (error) {
    return res.status(500).json({
      error: "OCR request error",
      detail: error?.message || String(error),
    });
  }
});

app.post("/api/convert", async (req, res) => {
  const { text, systemPrompt, userPrompt } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), jsonTimeoutMs);

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
      return res.status(response.status).json({
        error: "JSON conversion request failed",
        detail,
      });
    }

    const data = await response.json();
    const content = data?.message?.content || "";

    return res.json({ content });
  } catch (error) {
    return res.status(500).json({
      error: "JSON conversion error",
      detail: error?.message || String(error),
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
