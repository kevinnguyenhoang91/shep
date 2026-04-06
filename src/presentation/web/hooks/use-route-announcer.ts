'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function useRouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Small delay to let the page title update after navigation
    const timer = setTimeout(() => {
      const title = document.title || 'Page loaded';
      setAnnouncement(`Navigated to ${title}`);
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname]);

  return announcement;
}
