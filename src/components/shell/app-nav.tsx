"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TelescopeIcon, LayoutDashboardIcon, BellIcon, SettingsIcon, ZapIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** `ready: false` marks a roadmap section: rendered, but not linked, so Next never prefetches a 404. */
const ITEMS = [
  { href: "/discover", label: "Discover", icon: TelescopeIcon, ready: true },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboardIcon, ready: false },
  { href: "/alerts", label: "Alerts", icon: BellIcon, ready: false },
  { href: "/settings", label: "Settings", icon: SettingsIcon, ready: false },
];

const ITEM_CLASS =
  "mb-1 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors";

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-sidebar py-3">
      <Link
        href="/discover"
        className="mb-4 flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
        title="clickpower"
      >
        <ZapIcon className="size-4" />
      </Link>
      {ITEMS.map((it) => {
        const active = path.startsWith(it.href);
        const icon = <it.icon className="size-4" />;
        return it.ready ? (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            className={cn(ITEM_CLASS, "hover:bg-accent hover:text-foreground", active && "bg-accent text-primary")}
          >
            {icon}
          </Link>
        ) : (
          <Tooltip key={it.href}>
            <TooltipTrigger
              render={
                <span aria-disabled className={cn(ITEM_CLASS, "cursor-not-allowed opacity-35")}>
                  {icon}
                </span>
              }
            />
            <TooltipContent side="right">{it.label} · coming soon</TooltipContent>
          </Tooltip>
        );
      })}
      <div className="mt-auto rotate-180 font-mono text-[9px] tracking-[0.3em] text-muted-foreground/50 [writing-mode:vertical-rl]">
        CLICKPOWER
      </div>
    </nav>
  );
}
