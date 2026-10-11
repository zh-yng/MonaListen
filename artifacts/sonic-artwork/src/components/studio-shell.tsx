import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { Library, LogOut, Settings } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/studio', label: 'Library', icon: Library, match: (l: string) => l === '/studio' || l.startsWith('/studio/artworks') },
  { href: '/studio/settings', label: 'Services', icon: Settings, match: (l: string) => l.startsWith('/studio/settings') },
];

export function StudioShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  const active = (n: (typeof nav)[number]) => (n.href === '/studio' ? n.match(loc) && !loc.startsWith('/studio/settings') : n.match(loc));
  return (
    <div className="grain min-h-[100dvh] md:flex">
      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-[100dvh] md:w-60 md:flex-col md:justify-between md:p-6">
        <div className="flex items-center justify-between px-4 py-3 md:block md:p-0">
          <Logo light href="/studio" />
          <nav aria-label="Studio" className="flex gap-1 md:mt-10 md:flex-col">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.toLowerCase()}`}
                aria-current={active(n) ? 'page' : undefined}
                className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent',
                  active(n) && 'bg-sidebar-accent text-sidebar-primary')}>
                <n.icon className="h-4 w-4" /><span className="hidden sm:inline md:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden md:block">
          <p className="font-mono-ui truncate text-xs opacity-70" data-testid="text-user">{user?.primaryEmailAddress?.emailAddress ?? user?.username ?? ''}</p>
          <button type="button" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: base })}
            className="mt-3 flex items-center gap-2 text-sm opacity-80 transition-opacity hover:opacity-100">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
