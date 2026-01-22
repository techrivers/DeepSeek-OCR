import * as pdfjsLib from "/vendor/pdfjs/build/pdf.mjs";

const fileInput = document.getElementById("fileInput");
const chooseFile = document.getElementById("chooseFile");
const dropzone = document.getElementById("dropzone");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const statusText = document.getElementById("statusText");
const resultsGrid = document.getElementById("resultsGrid");
const documentJson = document.getElementById("documentJson");
const copyJson = document.getElementById("copyJson");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageIndicator = document.getElementById("pageIndicator");
const settingsDialog = document.getElementById("settingsDialog");
const settingsButton = document.getElementById("settingsButton");
const systemPromptInput = document.getElementById("systemPrompt");
const userPromptInput = document.getElementById("userPrompt");
const saveSettings = document.getElementById("saveSettings");

const state = {
  pdf: null,
  pages: [],
  busy: false,
  maxPages: 25,
  sourceType: null,
  renderScale: 2.5,
  enhancePdf: true,
  enhanceMode: "contrast",
  enhanceContrast: 1.15,
  enhanceThreshold: 200,
  currentPageIndex: 0,
};

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "/vendor/pdfjs/build/pdf.worker.mjs";

loadSettings();
fetchConfig();
updatePager();

chooseFile.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer.files?.[0];
  if (file) {
    handleFile(file);
  }
});

dropzone.addEventListener("click", () => fileInput.click());

settingsButton.addEventListener("click", () => {
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
  } else {
    settingsDialog.setAttribute("open", "");
  }
});

settingsDialog.addEventListener("click", (event) => {
  if (event.target !== settingsDialog) return;
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
});

saveSettings.addEventListener("click", () => {
  localStorage.setItem(
    "ocrSettings",
    JSON.stringify({
      systemPrompt: systemPromptInput.value,
      userPrompt: userPromptInput.value,
    })
  );
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
});

startBtn.addEventListener("click", async () => {
  if ((!state.pdf && state.pages.length === 0) || state.busy) return;
  state.busy = true;
  startBtn.disabled = true;
  resetBtn.disabled = true;
  statusText.textContent =
    state.sourceType === "pdf" ? "Rendering pages..." : "Running OCR...";

  try {
    if (state.sourceType === "pdf") {
      await renderAllPages();
    }
    statusText.textContent = "Running OCR...";
    await runOcrPipeline();
    statusText.textContent = "Done.";
  } catch (error) {
    statusText.textContent = error?.message || "Something went wrong.";
  } finally {
    state.busy = false;
    resetBtn.disabled = false;
  }
});

resetBtn.addEventListener("click", resetAll);
copyJson.addEventListener("click", () => {
  const content = documentJson.textContent || "";
  if (!content) return;
  navigator.clipboard.writeText(content);
});
prevPage.addEventListener("click", () => goToPage(state.currentPageIndex - 1));
nextPage.addEventListener("click", () => goToPage(state.currentPageIndex + 1));

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    await handleFile(file);
  }
}

async function handleFile(file) {
  if (file.type === "application/pdf") {
    await handlePdfFile(file);
    return;
  }

  if (file.type.startsWith("image/")) {
    await handleImageFile(file);
    return;
  }

  statusText.textContent = "Please choose a PDF or image file.";
}

async function handlePdfFile(file) {
  if (!pdfjsLib) {
    statusText.textContent =
      "PDF renderer failed to load. Check that /vendor/pdfjs is reachable.";
    return;
  }
  if (file.type !== "application/pdf") {
    statusText.textContent = "Please choose a PDF file.";
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  state.pdf = pdf;
  state.pages = [];
  state.sourceType = "pdf";
  resultsGrid.innerHTML = "";
  state.currentPageIndex = 0;

  const totalPages = pdf.numPages;
  if (totalPages > state.maxPages) {
    statusText.textContent = `PDF has ${totalPages} pages. Limit is ${state.maxPages}.`;
    startBtn.disabled = true;
    resetBtn.disabled = false;
    return;
  }

  statusText.textContent = `${totalPages} page(s) ready.`;
  startBtn.disabled = false;
  resetBtn.disabled = false;
}

async function handleImageFile(file) {
  const dataUrl = await fileToDataUrl(file);
  state.pdf = null;
  state.pages = [
    {
      pageNumber: 1,
      dataUrl,
      base64: dataUrl.split(",")[1],
    },
  ];
  state.sourceType = "image";
  resultsGrid.innerHTML = "";
  renderCard(1, dataUrl);
  state.currentPageIndex = 0;
  goToPage(0);
  statusText.textContent = "1 image ready.";
  startBtn.disabled = false;
  resetBtn.disabled = false;
}

async function renderAllPages() {
  const totalPages = state.pdf.numPages;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await state.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: state.renderScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    if (state.enhancePdf) {
      enhanceCanvasForOcr(canvas, context, {
        mode: state.enhanceMode,
        contrast: state.enhanceContrast,
        threshold: state.enhanceThreshold,
      });
    }
    const dataUrl = canvas.toDataURL("image/png");
    state.pages.push({
      pageNumber,
      dataUrl,
      base64: dataUrl.split(",")[1],
    });

    renderCard(pageNumber, dataUrl);
    statusText.textContent = `Rendered ${pageNumber}/${totalPages} pages...`;
  }
  goToPage(0);
}

async function runOcrPipeline() {
  const settings = loadSettings();
  const combinedText = [];
  const totalPages = state.pages.length;
  let completed = 0;

  for (const page of state.pages) {
    updateCardStatus(page.pageNumber, "OCR in progress...");
    statusText.textContent = `Running OCR... ${completed}/${totalPages}`;

    const ocrResponse = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: page.base64 }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      updateCardStatus(page.pageNumber, "OCR failed");
      updateCardOutput(page.pageNumber, "", errorText);
      continue;
    }

    const ocrData = await ocrResponse.json();
    updateCardText(page.pageNumber, ocrData.text || "");
    combinedText.push(
      `--- Page ${page.pageNumber} ---\n${ocrData.text || ""}`.trim()
    );

    updateCardStatus(page.pageNumber, "OCR complete");
    completed += 1;
    statusText.textContent = `Running OCR... ${completed}/${totalPages}`;
  }

  if (settings?.systemPrompt || settings?.userPrompt) {
    statusText.textContent = "Converting document to JSON...";

    const jsonResponse = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: combinedText.join("\n\n"),
        systemPrompt: settings.systemPrompt || "",
        userPrompt: settings.userPrompt || "",
      }),
    });

    if (!jsonResponse.ok) {
      const errorText = await jsonResponse.text();
      state.pages.forEach((page) => {
        updateCardStatus(page.pageNumber, "JSON conversion failed");
        updateCardOutput(page.pageNumber, "", errorText);
      });
      return;
    }

    const jsonData = await jsonResponse.json();
    documentJson.textContent = jsonData.content || "";
    copyJson.disabled = !documentJson.textContent;
    state.pages.forEach((page) => {
      updateCardOutput(page.pageNumber, jsonData.content || "", "");
      updateCardStatus(page.pageNumber, "Complete");
    });
  } else {
    state.pages.forEach((page) => {
      updateCardStatus(page.pageNumber, "Complete");
    });
  }
}

function renderCard(pageNumber, dataUrl) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.page = pageNumber;
  card.innerHTML = `
    <div class="meta">
      <span>Page ${pageNumber}</span>
      <span class="badge">Queued</span>
    </div>
    <img src="${dataUrl}" alt="Page ${pageNumber} preview" />
    <label>
      OCR text
      <textarea readonly></textarea>
    </label>
    <label>
      JSON output
      <pre></pre>
    </label>
  `;
  resultsGrid.appendChild(card);
}

function updateCardStatus(pageNumber, status) {
  const card = findCard(pageNumber);
  if (!card) return;
  const badge = card.querySelector(".badge");
  if (badge) {
    badge.textContent = status;
  }
}

function updateCardText(pageNumber, text) {
  const card = findCard(pageNumber);
  if (!card) return;
  const textarea = card.querySelector("textarea");
  if (textarea) {
    textarea.value = text;
  }
}

function updateCardOutput(pageNumber, content, fallback) {
  const card = findCard(pageNumber);
  if (!card) return;
  const pre = card.querySelector("pre");
  if (pre) {
    pre.textContent = content || fallback || "";
  }
}

function findCard(pageNumber) {
  return resultsGrid.querySelector(`[data-page="${pageNumber}"]`);
}

function resetAll() {
  state.pdf = null;
  state.pages = [];
  state.sourceType = null;
  state.currentPageIndex = 0;
  fileInput.value = "";
  resultsGrid.innerHTML = "";
  documentJson.textContent = "";
  copyJson.disabled = true;
  updatePager();
  startBtn.disabled = true;
  resetBtn.disabled = true;
  statusText.textContent = "Waiting for a PDF or image.";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadSettings() {
  const raw = localStorage.getItem("ocrSettings");
  if (!raw) return null;
  try {
    const settings = JSON.parse(raw);
    systemPromptInput.value = settings.systemPrompt || "";
    userPromptInput.value = settings.userPrompt || "";
    return settings;
  } catch {
    return null;
  }
}

async function fetchConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    state.maxPages = config.maxPages || state.maxPages;
    state.renderScale = config.pdfRenderScale || state.renderScale;
    state.enhancePdf =
      typeof config.pdfEnhance === "boolean" ? config.pdfEnhance : state.enhancePdf;
    state.enhanceMode = config.pdfEnhanceMode || state.enhanceMode;
    state.enhanceContrast =
      typeof config.pdfEnhanceContrast === "number"
        ? config.pdfEnhanceContrast
        : state.enhanceContrast;
    state.enhanceThreshold =
      typeof config.pdfEnhanceThreshold === "number"
        ? config.pdfEnhanceThreshold
        : state.enhanceThreshold;
  } catch {
    // Ignore config errors and keep defaults.
  }
}

function enhanceCanvasForOcr(canvas, context, options) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = options?.contrast ?? 1.15;
  const threshold = options?.threshold ?? 200;
  const mode = options?.mode ?? "contrast";
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const adjusted = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
    if (mode === "binarize") {
      const value = adjusted > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    } else if (mode === "contrast") {
      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
    }
  }
  context.putImageData(imageData, 0, 0);
}

function goToPage(index) {
  if (!state.pages.length) {
    updatePager();
    return;
  }
  const clamped = Math.max(0, Math.min(index, state.pages.length - 1));
  state.currentPageIndex = clamped;
  const cards = resultsGrid.querySelectorAll(".card");
  cards.forEach((card, idx) => {
    if (idx === clamped) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
  updatePager();
}

function updatePager() {
  const total = state.pages.length;
  const current = total ? state.currentPageIndex + 1 : 0;
  pageIndicator.textContent = `Page ${current} of ${total}`;
  prevPage.disabled = total === 0 || state.currentPageIndex === 0;
  nextPage.disabled = total === 0 || state.currentPageIndex >= total - 1;
}
