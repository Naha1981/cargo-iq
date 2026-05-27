// POST /api/ai/extract - AI document extraction endpoint
// Uses z-ai-web-dev-sdk for AI-powered extraction (VLM for images, LLM for text/PDF)
import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import {
  EXTRACTION_SYSTEM_PROMPT,
  defaultExtraction,
  parseExtractionResponse,
  type ExtractionResult,
  type DocumentType,
} from "@/lib/prompts";

// ─── Helper: determine if file is an image ───────────────────────────────────

function isImageFile(contentType: string): boolean {
  return contentType === "image/png" || contentType === "image/jpeg" || contentType === "image/jpg" || contentType === "image/webp";
}

function isPdfFile(contentType: string): boolean {
  return contentType === "application/pdf";
}

// ─── Helper: convert ArrayBuffer to base64 ───────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Support both FormData (file upload) and JSON (text extraction) modes
    let file: File | null = null;
    let documentType: DocumentType | undefined;
    let textContent: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // FormData mode — file upload
      const formData = await request.formData();
      file = formData.get("file") as File | null;
      documentType = (formData.get("documentType") as DocumentType) || undefined;
      textContent = (formData.get("text") as string) || null;

      if (!file && !textContent) {
        return NextResponse.json(
          { error: "bad_request", message: "Provide a 'file' (FormData upload) or 'text' field" },
          { status: 400 }
        );
      }
    } else {
      // JSON mode — text extraction only
      const body = await request.json();
      textContent = body.text || null;
      documentType = body.documentType || undefined;

      if (!textContent) {
        return NextResponse.json(
          { error: "bad_request", message: "Provide a 'file' (FormData upload) or 'text' field" },
          { status: 400 }
        );
      }
    }

    // Initialize ZAI SDK
    const zai = await ZAI.create();

    let extractionResult: ExtractionResult;

    // ── Image extraction path (VLM) ────────────────────────────────────────
    if (file && isImageFile(file.type)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:${file.type};base64,${base64}`;

      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      const userMessage: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        {
          type: "text",
          text: `Extract all shipment fields from this logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
        },
        {
          type: "image_url",
          image_url: { url: dataUri },
        },
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
      extractionResult = parseExtractionResponse(content);
      extractionResult.extraction_notes =
        (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
        `Extracted via VLM from image (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;
    }
    // ── PDF extraction path (VLM with file_url or LLM with extracted text) ─
    else if (file && isPdfFile(file.type)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:application/pdf;base64,${base64}`;

      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      // Try VLM with PDF file_url first
      try {
        const userMessage = [
          {
            type: "text",
            text: `Extract all shipment fields from this PDF logistics document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
          },
          {
            type: "file_url",
            file_url: { url: dataUri },
          },
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
        extractionResult = parseExtractionResponse(content);
        extractionResult.extraction_notes =
          (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
          `Extracted via VLM from PDF (${(file.size / 1024).toFixed(1)}KB)`;
      } catch {
        // Fallback: if VLM with PDF fails, return default with note
        extractionResult = defaultExtraction();
        extractionResult.extraction_notes =
          `PDF extraction via VLM failed. File size: ${(file.size / 1024).toFixed(1)}KB. Consider extracting text separately.`;
      }
    }
    // ── Text extraction path (LLM) ─────────────────────────────────────────
    else if (textContent) {
      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

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
      extractionResult = parseExtractionResponse(content);
      extractionResult.extraction_notes =
        (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
        "Extracted via LLM from text input";
    }
    // ── Other file type — attempt with VLM ─────────────────────────────────
    else if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:${file.type};base64,${base64}`;

      const docTypeHint = documentType
        ? `\nThis document is a ${documentType.replace(/_/g, " ")}. Focus extraction accordingly.`
        : "";

      const userMessage = [
        {
          type: "text",
          text: `Extract all shipment fields from this document.${docTypeHint}\n\nRespond with valid JSON only using the schema provided in the system prompt.`,
        },
        {
          type: "image_url",
          image_url: { url: dataUri },
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
        extractionResult = parseExtractionResponse(content);
        extractionResult.extraction_notes =
          (extractionResult.extraction_notes ? extractionResult.extraction_notes + " " : "") +
          `Extracted via VLM from file (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;
      } catch {
        extractionResult = defaultExtraction();
        extractionResult.extraction_notes =
          `Extraction failed for file type: ${file.type}. Unsupported format.`;
      }
    } else {
      return NextResponse.json(
        { error: "bad_request", message: "No file or text provided for extraction" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      extracted: extractionResult,
      document_type: documentType || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "internal_error",
        message: "Failed to extract document data",
        extracted: defaultExtraction(),
      },
      { status: 500 }
    );
  }
}
