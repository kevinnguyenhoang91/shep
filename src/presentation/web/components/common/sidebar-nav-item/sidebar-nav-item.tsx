'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useSoundAction } from '@/hooks/use-sound-action';

export interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  /** Optional numeric badge shown at the trailing edge of the nav item. Hidden when 0. */
  badge?: number;
}

export function SidebarNavItem({
  icon: Icon,
  label,
  href,
  active = false,
  badge,
}: SidebarNavItemProps) {
  const navigateSound = useSoundAction('navigate');

  return (
    <SidebarMenuItem data-testid="sidebar-nav-item">
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link href={href as Route} onClick={() => navigateSound.play()}>
          <Icon />
          <span>{label}</span>
          {badge != null && badge > 0 ? (
            <span className="bg-destructive text-destructive-foreground ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
