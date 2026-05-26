// POST /api/documents/upload - Upload and process a document
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const docType = formData.get("doc_type") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "bad_request", message: "No file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedTypes.includes(ext)) {
      return NextResponse.json(
        { error: "bad_request", message: `File type ${ext} not allowed` },
        { status: 400 }
      );
    }

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Get or create default organisation
    let org = await db.organisation.findFirst();
    if (!org) {
      org = await db.organisation.create({
        data: { name: "Demo Organisation", slug: "demo" },
      });
    }

    // Create document record
    const document = await db.document.create({
      data: {
        orgId: org.id,
        storagePath: filePath,
        filename: file.name,
        fileType: ext === "jpeg" ? "jpg" : ext,
        docType: docType || "unknown",
        status: "pending",
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        orgId: org.id,
        entityType: "document",
        entityId: document.id,
        action: "uploaded",
        actorType: "user",
        metadata: JSON.stringify({ filename: file.name, sizeBytes: buffer.length }),
      },
    });

    return NextResponse.json({ documentId: document.id, status: "queued" });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to upload document" },
      { status: 500 }
    );
  }
}
