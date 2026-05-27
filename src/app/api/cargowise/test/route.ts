// POST /api/cargowise/test - Test CargoWise connection
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgIdFromRequest } from "@/lib/api-utils";
import { safeDecrypt } from "@/lib/crypto";
import { generateShipmentXml, type ShipmentData, type OrgData } from "@/lib/cargowise-xml";

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgIdFromRequest(request);
    const body = await request.json();

    // Accept org credentials or use stored ones
    const testServerUrl = (body.serverUrl as string) || null;
    const testUsername = (body.username as string) || null;
    const testPassword = (body.password as string) || null;
    const testEnterpriseId = (body.enterpriseId as string) || null;

    // Fetch stored org config
    const org = await db.organisation.findUnique({ where: { id: orgId } });

    const serverUrl = testServerUrl || org?.cwServerUrl || null;
    const enterpriseId = testEnterpriseId || org?.cwEnterpriseId || null;

    if (!serverUrl) {
      return NextResponse.json({
        status: "error",
        message: "No CargoWise server URL configured. Please set up your CargoWise integration in Settings.",
        hint: "Go to Settings → CargoWise Integration to configure your server URL and credentials.",
      });
    }

    // Get credentials — use provided ones or decrypt stored ones
    let username = testUsername;
    let password = testPassword;

    if (!username || !password) {
      if (org?.cwCredentialsEnc) {
        const decrypted = safeDecrypt(org.cwCredentialsEnc);
        if (decrypted) {
          try {
            const stored = JSON.parse(decrypted);
            username = username || stored.username;
            password = password || stored.password;
          } catch {
            // Invalid stored credentials format
          }
        }
      }
    }

    // Generate a minimal test XML
    const testData: ShipmentData = {
      reference: "CIQ-TEST-CONNECTION",
      shipperName: "CargoIQ Connection Test",
      shipperAddress: null,
      consigneeName: null,
      consigneeAddress: null,
      notifyParty: null,
      originPort: "ZADUR",
      destinationPort: "ZAJNB",
      cargoDescription: "Connection test shipment — discard",
      hsCodePrimary: null,
      grossWeight: 1,
      netWeight: 1,
      weightUnit: "KGS",
      numberOfPackages: 1,
      incoterms: null,
      invoiceNumber: null,
      invoiceValue: null,
      currency: "USD",
      awbOrBlNumber: null,
      vesselOrFlight: null,
      eta: null,
      etd: null,
      shipmentType: null,
      lineItems: [],
    };

    const orgData: OrgData = {
      id: orgId,
      name: org?.name || "Test Org",
      cwServerUrl: serverUrl,
      cwEnterpriseId: enterpriseId,
      cwServerId: org?.cwServerId || null,
    };

    const testXml = generateShipmentXml(testData, orgData);

    // Send test XML to eAdaptor endpoint with 10s timeout
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/xml",
      };

      if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString("base64");
        headers["Authorization"] = `Basic ${auth}`;
      }

      const eadaptorUrl = `${serverUrl}/eAdaptor`;
      const response = await fetch(eadaptorUrl, {
        method: "POST",
        headers,
        body: testXml,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const responseBody = await response.text();
        return NextResponse.json({
          status: "connected",
          message: "Successfully connected to CargoWise eAdaptor.",
          serverUrl,
          enterpriseId: enterpriseId || null,
          responsePreview: responseBody.substring(0, 500),
        });
      } else {
        const responseText = await response.text().catch(() => "");
        return NextResponse.json({
          status: "error",
          message: `CargoWise returned HTTP ${response.status}: ${response.statusText}`,
          serverUrl,
          hint: response.status === 401
            ? "Authentication failed. Check your CargoWise credentials."
            : response.status === 404
              ? "eAdaptor endpoint not found. Verify your server URL."
              : "Check your CargoWise server configuration.",
          responsePreview: responseText.substring(0, 500),
        });
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unknown error";

      return NextResponse.json({
        status: "error",
        message: `Could not connect to CargoWise: ${message}`,
        serverUrl,
        hint: message.includes("timeout")
          ? "Connection timed out after 10 seconds. Check if the server URL is correct and accessible."
          : message.includes("ECONNREFUSED")
            ? "Connection refused. The server may be down or the URL may be incorrect."
            : message.includes("ENOTFOUND")
              ? "Server not found. Check the CargoWise server URL."
              : "Verify your CargoWise server URL and network connectivity.",
      });
    }
  } catch (error) {
    console.error("Error testing CargoWise connection:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Connection test failed" },
      { status: 500 }
    );
  }
}
