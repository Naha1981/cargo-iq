// CargoIQ — Notification Dispatch Helper
// Non-blocking notification dispatch via WebSocket service
// All requests use relative paths with XTransformPort query param

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationEvent =
  | "shipment:created"
  | "shipment:updated"
  | "shipment:approved"
  | "shipment:rejected"
  | "shield:pass"
  | "shield:hold"
  | "shield:fail"
  | "cw:draft_created"
  | "cw:push_success"
  | "cw:push_failed"
  | "document:extracted"
  | "document:failed";

export interface NotificationPayload {
  event: NotificationEvent;
  data: Record<string, unknown>;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_SERVICE_PORT = 3003;
const NOTIFY_ENDPOINT = "/api/emit";

// ---------------------------------------------------------------------------
// notify — Core dispatch function
// ---------------------------------------------------------------------------

/**
 * Dispatch a notification event to the WebSocket service.
 *
 * Non-blocking: notification failures are logged as warnings but never throw.
 * Uses relative path with XTransformPort query param per gateway rules.
 *
 * @param event - The notification event type
 * @param data - Event payload data
 */
export async function notify(
  event: NotificationEvent,
  data: Record<string, unknown>
): Promise<void> {
  const payload: NotificationPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const url = `${NOTIFY_ENDPOINT}?XTransformPort=${WS_SERVICE_PORT}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-blocking: log warning, never throw
    console.warn(
      `[notify] Failed to dispatch "${event}":`,
      err instanceof Error ? err.message : err
    );
  }
}

// ---------------------------------------------------------------------------
// notifyShipment — Convenience for shipment events
// ---------------------------------------------------------------------------

/**
 * Send a shipment-related notification.
 *
 * @param event - Shipment event type
 * @param shipmentId - The shipment ID
 * @param extra - Additional data to include in the payload
 */
export async function notifyShipment(
  event: NotificationEvent,
  shipmentId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await notify(event, {
    shipmentId,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// notifyCw — Convenience for CargoWise events
// ---------------------------------------------------------------------------

/**
 * Send a CargoWise-related notification.
 *
 * @param event - CW event type
 * @param shipmentId - The shipment ID
 * @param extra - Additional data to include in the payload
 */
export async function notifyCw(
  event: NotificationEvent,
  shipmentId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await notify(event, {
    shipmentId,
    category: "cargowise",
    ...extra,
  });
}
