'use client';

import { useRouteAnnouncer } from '@/hooks/use-route-announcer';

export function RouteAnnouncer() {
  const announcement = useRouteAnnouncer();

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
