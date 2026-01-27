# DeepSeek OCR Studio - Requirements

## Overview
DeepSeek OCR Studio is a web application that performs optical character recognition (OCR) on PDF documents and images using local Ollama models. It converts PDFs to images, runs OCR on each page, and then transforms the extracted text into structured JSON data.

## System Requirements

### Backend
- Node.js (version not specified, but package.json uses ES modules)
- Express.js server
- Ollama service running locally or accessible via network
- pdfjs-dist library for PDF processing

### Frontend
- Modern web browser with JavaScript enabled
- Support for ES modules
- Canvas rendering capabilities for PDF processing

### Dependencies
- dotenv: Environment variable management
- express: Web server framework
- pdfjs-dist: PDF rendering library

## Environment Variables
The application uses several configurable environment variables:

- PORT: Server port (default: 3000)
- OLLAMA_BASE_URL: Base URL for Ollama service (default: http://localhost:11434)
- OCR_MODEL: Model used for OCR (default: deepseek-ocr)
- JSON_MODEL: Model used for JSON conversion (default: gpt-oss:120b-cloud)
- MAX_PAGES: Maximum number of pages processed from a PDF (default: 25)
- REQUEST_TIMEOUT_MS: General request timeout in milliseconds (default: 60000)
- OCR_TIMEOUT_MS: OCR request timeout in milliseconds (default: REQUEST_TIMEOUT_MS value)
- JSON_TIMEOUT_MS: JSON conversion timeout in milliseconds (default: 120000)
- PDF_RENDER_SCALE: Scale factor for PDF rendering (default: 2.5)
- PDF_ENHANCE: Whether to enhance PDF images (default: true)
- PDF_ENHANCE_MODE: Enhancement mode (default: contrast)
- PDF_ENHANCE_CONTRAST: Contrast enhancement factor (default: 1.15)
- PDF_ENHANCE_THRESHOLD: Threshold for enhancement (default: 200)

## Features

### File Processing
- Accepts PDF documents and image files
- Converts PDFs to individual page images
- Processes up to MAX_PAGES pages per document
- Supports drag-and-drop file uploads

### OCR Processing
- Performs optical character recognition on each page/image
- Uses configurable Ollama model for OCR
- Configurable timeout for OCR requests

### Text to JSON Conversion
- Converts extracted text to structured JSON format
- Customizable system and user prompts for JSON conversion
- Uses configurable Ollama model for JSON conversion
- Configurable timeout for JSON conversion requests

### User Interface
- Clean web interface for file upload and processing
- Real-time status updates during processing
- Settings dialog for configuring JSON conversion prompts
- Page navigation for multi-page documents
- Copy to clipboard functionality for JSON output

## Technical Architecture

### Backend (server.js)
- Express.js server handling API requests
- Two main endpoints:
  - /api/ocr: Performs OCR on base64 encoded images
  - /api/convert: Converts text to JSON using LLM
- Static file serving for frontend assets
- Configuration endpoint (/api/config) exposing client-side settings

### Frontend (public/)
- HTML/CSS/JavaScript client interface
- PDF.js integration for PDF rendering
- Drag-and-drop file handling
- Responsive design with modern CSS variables
- Client-side state management
- Settings persistence using localStorage

## Data Flow
1. User uploads PDF or image file
2. PDF files are rendered to images using PDF.js
3. Each page/image is sent to backend for OCR processing
4. Extracted text is sent to backend for JSON conversion
5. Final JSON structure is displayed in UI
6. User can copy JSON output to clipboard

## Sample Output
The application produces structured JSON output based on the document content, containing fields such as:
- Document type
- Payer information (name, address)
- Subscriber information (member ID, group number)
- Service details (dates, procedures, amounts)
- Payment information