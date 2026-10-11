import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeaveGuard } from '@/components/leave-guard';
import { useGuardedLocation } from '@/lib/nav-guard';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import Library from '@/pages/library';
import Editor from '@/pages/editor';
import SettingsPage from '@/pages/settings';
import Listen from '@/pages/listen';

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const queryClient = new QueryClient();

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(14 82% 50%)',
    colorForeground: 'hsl(232 35% 14%)',
    colorMutedForeground: 'hsl(232 12% 36%)',
    colorDanger: 'hsl(355 70% 42%)',
    colorBackground: 'hsl(40 40% 97%)',
    colorInput: 'hsl(38 33% 94%)',
    colorInputForeground: 'hsl(232 35% 14%)',
    colorNeutral: 'hsl(232 35% 14%)',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.375rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(40_40%_97%)] rounded-xl w-[440px] max-w-full overflow-hidden border border-[hsl(35_22%_82%)] shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[hsl(232_35%_14%)]',
    headerSubtitle: 'text-[hsl(232_12%_36%)]',
    socialButtonsBlockButtonText: 'text-[hsl(232_35%_14%)]',
    formFieldLabel: 'text-[hsl(232_35%_14%)]',
    footerActionLink: 'text-[hsl(232_58%_38%)] font-semibold',
    footerActionText: 'text-[hsl(232_12%_36%)]',
    dividerText: 'text-[hsl(232_12%_36%)]',
    identityPreviewEditButton: 'text-[hsl(232_58%_38%)]',
    formFieldSuccessText: 'text-[hsl(168_50%_28%)]',
    alertText: 'text-[hsl(355_70%_36%)]',
    logoBox: 'h-12',
    logoImage: 'h-12 w-12',
    formButtonPrimary: 'bg-[hsl(14_82%_50%)] hover:bg-[hsl(14_82%_44%)] text-[hsl(40_40%_97%)]',
    formFieldInput: 'border-[hsl(35_18%_72%)]',
  },
};

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grain relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[hsl(232_38%_12%)] px-4 py-10">
      <svg aria-hidden className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2" viewBox="0 0 100 100">
        {[10, 18, 26, 34, 42].map((r, i) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="hsl(14 82% 56%)" strokeWidth="0.08" opacity={0.5 - i * 0.08} className="ripple" style={{ animationDelay: `${i * 1}s` }} />
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}
const SignInPage = () => <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
const SignUpPage = () => <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) qc.clear();
      prev.current = id;
    });
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/studio" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}
function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}
const LibraryPage = () => <Protected><Library /></Protected>;
const EditorPage = () => <Protected><Editor /></Protected>;
const SettingsRoute = () => <Protected><SettingsPage /></Protected>;

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Back to the studio', subtitle: 'Sign in to keep composing' } },
        signUp: { start: { title: 'Open your studio', subtitle: 'Turn paintings into places you can hear' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/studio" component={LibraryPage} />
            <Route path="/studio/settings" component={SettingsRoute} />
            <Route path="/studio/artworks/:id" component={EditorPage} />
            <Route path="/listen/:id/:version" component={Listen} />
            <Route path="/listen/:id" component={Listen} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
        <LeaveGuard />
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath} hook={useGuardedLocation}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </TooltipProvider>
  );
}

export default App;
