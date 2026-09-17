"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Inbox, Library, Search, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/features/capture/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEMS = [
  { href: "/", label: "Capture", icon: SquarePen },
  { href: "/today", label: "Today", icon: Library },
  { href: "/research", label: "Research", icon: Library },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

export function AppShell({
  children,
  inboxCount = 0,
  email,
  isAdmin = false,
}: {
  children: React.ReactNode;
  inboxCount?: number;
  email?: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const cameraActive = pathname.startsWith("/camera");

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-sans text-sm font-semibold tracking-[0.22em] uppercase">
            Margin
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground",
                pathname.startsWith("/search") && "bg-secondary text-foreground",
              )}
            >
              <Search className="size-4" />
            </Link>
            <Link
              href="/camera"
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm md:hidden",
                cameraActive && "bg-secondary text-foreground",
              )}
            >
              <Camera className="size-4" />
              Camera
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                    active && "bg-secondary text-foreground",
                  )}
                >
                  {item.label}
                  {item.href === "/inbox" && inboxCount > 0 ? (
                    <span className="ml-2 font-mono text-[11px]">{inboxCount}</span>
                  ) : null}
                </Link>
              );
            })}
            <Link
              href="/camera"
              className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
            >
              <Camera className="size-4" />
              Camera
            </Link>
          </nav>
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Account
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {email ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">{email}</p>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/what-is-margin">What is Margin?</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                {isAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut();
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-10">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Mobile"
      >
        <div className="grid grid-cols-4">
          {ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-muted-foreground",
                  active && "text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-4" />
                  {item.href === "/inbox" && inboxCount > 0 ? (
                    <span className="absolute -right-2 -top-1.5 font-mono text-[9px] leading-none">
                      {inboxCount}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
