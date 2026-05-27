// CargoIQ — Notification Dispatch Helper
// Sends events to the WebSocket notification service for real-time broadcasting
// to connected frontend clients.

const NOTIFICATION_SERVICE_URL = "http://localhost:3003";

/**
 * Sends a notification event to the WebSocket notification service.
 * The service then broadcasts the event to all connected Socket.io clients.
 *
 * @param event - Event name (e.g., "shipment:created", "cw:draft_created")
 * @param data - Event payload as a plain object
 */
export async function notify(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    });

    if (!response.ok) {
      console.warn(
        `[Notify] Failed to send event "${event}": ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    // Non-blocking: notification failures should not break the main flow
    console.warn(
      `[Notify] Could not reach notification service for event "${event}":`,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Convenience helper for shipment events.
 */
export async function notifyShipment(
  event: string,
  shipmentId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await notify(event, { shipmentId, timestamp: new Date().toISOString(), ...extra });
}

/**
 * Convenience helper for CargoWise events.
 */
export async function notifyCw(
  event: string,
  shipmentId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await notify(event, { shipmentId, timestamp: new Date().toISOString(), ...extra });
}
