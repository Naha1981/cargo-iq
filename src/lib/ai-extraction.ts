// CargoIQ — AI Extraction Helper
// Uses z-ai-web-dev-sdk for AI-powered document extraction
// Supports VLM (vision) for images/PDFs and LLM for text content

import ZAI from "z-ai-web-dev-sdk";
import {
  EXTRACTION_SYSTEM_PROMPT,
  type ExtractionResult,
  type DocumentType,
  parseExtractionResponse,
  defaultExtraction,
} from "./prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractFromDocumentParams {
  /** Image file as base64 data URI (e.g. "data:image/png;base64,...") */
  imageDataUri?: string;
  /** PDF file as base64 data URI (e.g. "data:application/pdf;base64,...") */
  pdfDataUri?: string;
  /** Raw text content for LLM extraction */
  textContent?: string;
  /** MIME type of the uploaded file (image/png, image/jpeg, image/webp, application/pdf) */
  fileMimeType?: string;
  /** Hint about document type for focused extraction */
  documentType?: DocumentType;
  /** Maximum text length to send to the LLM (default: 30000) */
  maxTextLength?: number;
}

// ---------------------------------------------------------------------------
// Helper: build doc type hint for prompt
// ---------------------------------------------------------------------------

function buildDocTypeHint(documentType?: DocumentType): string {
  if (!documentType) return "";
  return `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`;
}

// ---------------------------------------------------------------------------
// Helper: convert ArrayBuffer to base64
// ---------------------------------------------------------------------------

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// extractFromDocument
// ---------------------------------------------------------------------------

/**
 * Extract structured shipment data from a document using AI.
 *
 * Two extraction paths:
 * 1. File/VLM: For images (PNG/JPG/WEBP) and PDFs, uses createVision() with base64 data URI
 * 2. Text/LLM: For text content, uses create() with system + user messages
 *
 * Returns a parsed ExtractionResult with confidence scores per field.
 */
export async function extractFromDocument(
  params: ExtractFromDocumentParams
): Promise<ExtractionResult> {
  const {
    imageDataUri,
    pdfDataUri,
    textContent,
    fileMimeType,
    documentType,
    maxTextLength = 30000,
  } = params;

  const docTypeHint = buildDocTypeHint(documentType);
  const zai = await ZAI.create();

  // ── Path 1: Image via VLM ──────────────────────────────────────────────
  if (imageDataUri) {
    const userMessage = [
      {
        type: "text",
        text: `Extract all shipment fields from this logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
      },
      {
        type: "image_url",
        image_url: { url: imageDataUri },
      },
    ];

    try {
      const response = await zai.chat.completions.createVision({
        model: "default",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage as unknown as string },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || "";
      const result = parseExtractionResponse(content);
      result.extraction_notes =
        (result.extraction_notes ? result.extraction_notes + " " : "") +
        `Extracted via VLM from image (${fileMimeType || "unknown"})`;
      return result;
    } catch (err) {
      const result = defaultExtraction();
      result.extraction_notes = `VLM image extraction failed: ${err instanceof Error ? err.message : "unknown error"}`;
      return result;
    }
  }

  // ── Path 2: PDF via VLM (file_url) ────────────────────────────────────
  if (pdfDataUri) {
    const userMessage = [
      {
        type: "text",
        text: `Extract all shipment fields from this PDF logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
      },
      {
        type: "file_url",
        file_url: { url: pdfDataUri },
      },
    ];

    try {
      const response = await zai.chat.completions.createVision({
        model: "default",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage as unknown as string },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || "";
      const result = parseExtractionResponse(content);
      result.extraction_notes =
        (result.extraction_notes ? result.extraction_notes + " " : "") +
        "Extracted via VLM from PDF";
      return result;
    } catch (err) {
      const result = defaultExtraction();
      result.extraction_notes = `VLM PDF extraction failed: ${err instanceof Error ? err.message : "unknown error"}. Consider extracting text separately.`;
      return result;
    }
  }

  // ── Path 3: Text via LLM ──────────────────────────────────────────────
  if (textContent) {
    try {
      const response = await zai.chat.completions.create({
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract all shipment fields from the following logistics document text.${docTypeHint}\n\nDOCUMENT TEXT:\n${textContent.substring(0, maxTextLength)}`,
          },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || "";
      const result = parseExtractionResponse(content);
      result.extraction_notes =
        (result.extraction_notes ? result.extraction_notes + " " : "") +
        "Extracted via LLM from text input";
      return result;
    } catch (err) {
      const result = defaultExtraction();
      result.extraction_notes = `LLM text extraction failed: ${err instanceof Error ? err.message : "unknown error"}`;
      return result;
    }
  }

  // No input provided
  const result = defaultExtraction();
  result.extraction_notes = "No image, PDF, or text content provided for extraction.";
  return result;
}
