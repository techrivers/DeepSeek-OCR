# DeepSeek OCR Studio

## Requirements

- Node.js 18+ and npm
- Ollama running locally or reachable over the network
- OCR model available in Ollama (default: `deepseek-ocr`)
- Optional JSON model in Ollama if you want structured output (default: `llama3.2`)

## The problem it solves

Manual text extraction from PDFs or images is slow and error-prone. This app turns documents into searchable text and can convert that text into structured JSON, all while keeping data local.

## What the agent does

The app accepts PDF or image uploads, renders PDF pages as images, sends each page to an Ollama OCR model, and optionally runs a second model to transform the combined text into JSON using a user-provided prompt.

## Key features

- Drag-and-drop PDF or image uploads
- Per-page OCR with progress status
- PDF render scaling and contrast/binarization enhancements
- Optional JSON conversion with custom system/user prompts
- Combined JSON output with one-click copy
- Page-by-page navigation of OCR results

## How we approached building it

We split the solution into a lightweight Express server and a vanilla JS frontend. The server exposes `/api/ocr` and `/api/convert` to proxy requests to Ollama with timeouts and guardrails. The frontend uses PDF.js to render pages, enhances images for better OCR, and orchestrates the OCR + JSON pipeline while keeping the UI responsive.

## Technology stack

- Node.js + Express
- PDF.js (`pdfjs-dist`)
- Vanilla JavaScript, HTML, and CSS
- Ollama models for OCR and JSON conversion

## Code in TR Github with ReadMe instructions

- Repository: `https://github.com/techrivers/DeepSeek-OCR`
- Setup and usage instructions are documented in this README.

## Video demonstration link

- `https://drive.google.com/file/d/1rbKJpreKkDaDvg9X7F8Ya1JBiTwIENxW/view?usp=sharing`
