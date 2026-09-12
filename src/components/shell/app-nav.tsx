"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TelescopeIcon, LayoutDashboardIcon, BellIcon, SettingsIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/discover", label: "Discover", icon: TelescopeIcon },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboardIcon },
  { href: "/alerts", label: "Alerts", icon: BellIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-sidebar py-3">
      <Link href="/discover" className="mb-4 flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground" title="clickpower">
        <ZapIcon className="size-4" />
      </Link>
      {ITEMS.map((it) => {
        const active = path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            className={cn(
              "mb-1 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-accent text-primary",
            )}
          >
            <it.icon className="size-4" />
          </Link>
        );
      })}
      <div className="mt-auto rotate-180 font-mono text-[9px] tracking-[0.3em] text-muted-foreground/50 [writing-mode:vertical-rl]">CLICKPOWER</div>
    </nav>
  );
}
