// CargoIQ — AI Extraction Helper
// Shared extraction logic using z-ai-web-dev-sdk for VLM/LLM extraction

import ZAI from "z-ai-web-dev-sdk";
import {
  EXTRACTION_SYSTEM_PROMPT,
  ExtractionResult,
  DocumentType,
  parseExtractionResponse,
  defaultExtraction,
} from "./prompts";

function isImageFile(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/jpeg" ||
    contentType === "image/jpg" ||
    contentType === "image/webp"
  );
}

function isPdfFile(contentType: string): boolean {
  return contentType === "application/pdf";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface ExtractionOptions {
  file?: File;
  textContent?: string;
  documentType?: DocumentType;
}

/**
 * Run AI extraction on a document (file or text).
 * Returns the extraction result, or a default low-confidence result on failure.
 */
export async function extractFromDocument(
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const { file, textContent, documentType } = options;

  const zai = await ZAI.create();
  const docTypeHint = documentType
    ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
    : "";

  try {
    // Image extraction path (VLM)
    if (file && isImageFile(file.type)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:${file.type};base64,${base64}`;

      const userMessage = [
        {
          type: "text",
          text: `Extract all shipment fields from this logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
        },
        { type: "image_url", image_url: { url: dataUri } },
      ];

      const response = await zai.chat.completions.createVision({
        model: "default",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || "";
      const result = parseExtractionResponse(content);
      result.extraction_notes =
        (result.extraction_notes ? result.extraction_notes + " " : "") +
        `Extracted via VLM from image (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;
      return result;
    }

    // PDF extraction path (VLM)
    if (file && isPdfFile(file.type)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:application/pdf;base64,${base64}`;

      try {
        const userMessage = [
          {
            type: "text",
            text: `Extract all shipment fields from this PDF logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
          },
          { type: "file_url", file_url: { url: dataUri } },
        ];

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
          `Extracted via VLM from PDF (${(file.size / 1024).toFixed(1)}KB)`;
        return result;
      } catch {
        const result = defaultExtraction();
        result.extraction_notes =
          `PDF extraction via VLM failed. File size: ${(file.size / 1024).toFixed(1)}KB. Consider extracting text separately.`;
        return result;
      }
    }

    // Text extraction path (LLM)
    if (textContent) {
      const response = await zai.chat.completions.create({
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract all shipment fields from the following logistics document text.${docTypeHint}\n\nDOCUMENT TEXT:\n${textContent.substring(0, 30000)}`,
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
    }

    // Other file type — attempt with VLM
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:${file.type};base64,${base64}`;

      try {
        const userMessage = [
          {
            type: "text",
            text: `Extract all shipment fields from this document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
          },
          { type: "image_url", image_url: { url: dataUri } },
        ];

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
          `Extracted via VLM from file (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;
        return result;
      } catch {
        const result = defaultExtraction();
        result.extraction_notes =
          `Extraction failed for file type: ${file.type}. Unsupported format.`;
        return result;
      }
    }

    // Nothing to extract
    const result = defaultExtraction();
    result.extraction_notes = "No file or text provided for extraction.";
    return result;
  } catch (error) {
    console.error("AI extraction error:", error);
    const result = defaultExtraction();
    result.extraction_notes =
      `AI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}. Manual entry required.`;
    return result;
  }
}
