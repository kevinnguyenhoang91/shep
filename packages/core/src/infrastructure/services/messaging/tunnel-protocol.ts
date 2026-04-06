/**
 * Commands.com Gateway tunnel protocol types.
 *
 * Matches the frame shapes sent and received by the Go implementation at
 * https://github.com/Commands-com/gateway/blob/main/internal/gateway/integrations_tunnel.go
 *
 * Frame flow:
 *   server → client: tunnel.connected              (after WebSocket open)
 *   client → server: tunnel.activate               (claim a route)
 *   server → client: tunnel.activate.result        (ok / error)
 *   server → client: tunnel.request                (forwarded webhook)
 *   client → server: tunnel.response               (reply to forwarded webhook)
 *   server → client: tunnel.route_deactivated      (route revoked)
 *   server → client: tunnel.error                  (any protocol error)
 */

export interface TunnelConnectedFrame {
  type: 'tunnel.connected';
  device_id: string;
  at?: string;
}

export interface TunnelActivateFrame {
  type: 'tunnel.activate';
  route_id: string;
}

export interface TunnelActivateResultFrame {
  type: 'tunnel.activate.result';
  route_id: string;
  ok: boolean;
  error?: string;
}

export interface TunnelRequestFrame {
  type: 'tunnel.request';
  request_id: string;
  route_id: string;
  method: string;
  path: string;
  /** HTTP headers as [name, value] pairs. */
  headers?: [string, string][];
  /** Base64-encoded request body. */
  body_base64?: string;
}

export interface TunnelResponseFrame {
  type: 'tunnel.response';
  request_id: string;
  status: number;
  headers?: [string, string][];
  /** Base64-encoded response body. */
  body_base64?: string;
}

export interface TunnelRouteDeactivatedFrame {
  type: 'tunnel.route_deactivated';
  route_id: string;
  reason?: string;
}

export interface TunnelErrorFrame {
  type: 'tunnel.error';
  error: string;
}

export type TunnelInboundFrame =
  | TunnelConnectedFrame
  | TunnelActivateResultFrame
  | TunnelRequestFrame
  | TunnelRouteDeactivatedFrame
  | TunnelErrorFrame;

export type TunnelOutboundFrame = TunnelActivateFrame | TunnelResponseFrame;

/** Higher-level, decoded request presented to the consuming handler. */
export interface DecodedTunnelRequest {
  requestId: string;
  routeId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  /** Decoded UTF-8 body; empty string if no body. */
  body: string;
}

/** Response returned by the handler for a decoded request. */
export interface TunnelRequestResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}
