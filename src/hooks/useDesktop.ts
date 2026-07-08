/**
 * useDesktop — React hook for the Desktop Service client.
 *
 * Provides:
 *   - connectionState  : connected / disconnected / error
 *   - lastEvent        : the most recent WS event from the desktop service
 *   - reconnect        : tear down and re-establish the WS connection
 *   - callTool         : execute a desktop tool via REST
 *   - isAvailable      : true when the WS is connected
 *
 * The hook auto-connects on mount and does NOT disconnect on unmount (the
 * singleton WS stays alive across route changes).
 */

import { useState, useEffect, useCallback } from "react";
import {
  desktopClient,
  type DesktopConnectionState,
  type DesktopEvent,
} from "../desktop/client";

export function useDesktop() {
  const [connectionState, setConnectionState] = useState<DesktopConnectionState>(
    desktopClient.state
  );
  const [lastEvent, setLastEvent] = useState<DesktopEvent | null>(null);

  useEffect(() => {
    const unsub = desktopClient.onEvent((event) => {
      if (event.type === "status") {
        setConnectionState(event.status as DesktopConnectionState);
      }
      setLastEvent(event);
    });

    // Attempt connection on mount if not already connected.
    desktopClient.connect();

    return () => {
      unsub();
      // Don't disconnect on unmount — the singleton WS stays alive across
      // hot-reloads and navigations so the event stream isn't lost.
    };
  }, []);

  const reconnect = useCallback(() => {
    desktopClient.disconnect();
    desktopClient.connect();
  }, []);

  const callTool = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      return desktopClient.callTool(name, args);
    },
    []
  );

  return {
    connectionState,
    lastEvent,
    reconnect,
    callTool,
    isAvailable: connectionState === "connected",
  } as const;
}
