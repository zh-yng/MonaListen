import { Link } from 'wouter';
import { ArrowRight, Ear, Eye, Layers, Smartphone } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

function HeroArt() {
  return (
    <svg viewBox="0 0 400 480" role="img" aria-label="A painting of color fields with outlined sound regions and rings of sound spreading outward" className="w-full max-w-md drop-shadow-2xl">
      <rect width="400" height="480" fill="hsl(40 40% 96%)" />
      <rect x="0" y="0" width="400" height="300" fill="hsl(232 58% 38%)" />
      <circle cx="270" cy="130" r="86" fill="hsl(14 82% 52%)" />
      <path d="M0 300 C90 240 170 330 260 280 S380 250 400 270 V480 H0Z" fill="hsl(42 90% 56%)" />
      <path d="M0 380 C100 340 200 420 400 360 V480 H0Z" fill="hsl(168 50% 28%)" />
      <path d="M40 90 L150 60 L180 170 L70 200Z" fill="none" stroke="hsl(40 40% 96%)" strokeWidth="2.5" strokeDasharray="6 5" />
      <g fill="hsl(40 40% 96%)"><circle cx="40" cy="90" r="5" /><circle cx="150" cy="60" r="5" /><circle cx="180" cy="170" r="5" /><circle cx="70" cy="200" r="5" /></g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="270" cy="130" r="90" fill="none" stroke="hsl(40 40% 96%)" strokeWidth="2" className="ripple" style={{ animationDelay: `${i * 1.6}s` }} />
      ))}
      <path d="M20 400 C120 360 220 440 380 390" fill="none" stroke="hsl(40 40% 96%)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const steps = [
  { n: '01', t: 'Bring the painting', d: 'Upload a photograph, crop it to the canvas edge, and describe it in words a listener will actually use.' },
  { n: '02', t: 'Trace what sounds', d: 'Draw polygons and curved paths over the sun, the river, the crowd. Each region gets its own prompt, volume and falloff.' },
  { n: '03', t: 'Approve every loop', d: 'Preview the exact audio that will ship. Nothing plays for visitors until you have listened and said yes.' },
];

export default function Landing() {
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Button asChild variant="ghost" data-testid="link-sign-in"><Link href="/sign-in">Sign in</Link></Button>
          <Button asChild data-testid="link-sign-up"><Link href="/sign-up">Open a studio</Link></Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-10 md:grid-cols-[1.1fr_.9fr]">
        <div className="rise">
          <p className="font-mono-ui mb-6 text-xs uppercase tracking-[0.25em] text-accent">An atelier for listening</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] md:text-7xl">
            Paint it once.<br /><em className="text-primary">Let them hear it</em> where it hangs.
          </h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">
            MonaListen is a studio for turning a painting into a composed field of sound. Blind visitors lift an iPhone toward the real canvas and walk through it by ear.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" data-testid="button-start"><Link href="/sign-up">Start composing <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" data-testid="button-have-account"><Link href="/sign-in">I have a studio</Link></Button>
          </div>
        </div>
        <div className="rise flex justify-center md:justify-end" style={{ animationDelay: '.15s' }}><HeroArt /></div>
      </section>

      <section className="bg-sidebar py-24 text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display max-w-2xl text-4xl font-semibold md:text-5xl">Three movements, in the order an artist works.</h2>
          <ol className="mt-16 grid gap-px bg-sidebar-border md:grid-cols-[1.2fr_1fr_1fr]">
            {steps.map((s) => (
              <li key={s.n} className="bg-sidebar p-8">
                <span className="font-mono-ui text-sm text-sidebar-primary">{s.n}</span>
                <h3 className="font-display mt-6 text-2xl font-semibold">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed opacity-75">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-16 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-semibold md:text-5xl">Honest by construction.</h2>
            <p className="mt-6 text-muted-foreground">There is no touch-screen stand-in and no pretend camera. Sound exists only when the phone truly recognises the painting in front of it.</p>
          </div>
          <dl className="space-y-8">
            {[
              { i: Eye, t: 'Real tracking only', d: 'The camera finds your painting. When it loses it, sound fades out and the visitor is guided back.' },
              { i: Layers, t: 'Everything loops, everything blends', d: 'Every region plays at once and swells or recedes with the distance between phone and shape.' },
              { i: Ear, t: 'No narration at the border', d: 'Crossing into a region never triggers a voice. A visitor can ask for a description whenever they choose.' },
              { i: Smartphone, t: 'Built for VoiceOver on iPhone', d: 'Large, labelled controls, spoken status changes, and a setup mode for a helper to place the phone.' },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div><dt className="font-display text-xl font-semibold">{t}</dt><dd className="mt-1 text-sm text-muted-foreground">{d}</dd></div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl bg-primary p-10 text-primary-foreground md:p-16">
          <h2 className="font-display max-w-2xl text-4xl font-semibold md:text-5xl">Your next opening has a soundtrack nobody has to see.</h2>
          <Button asChild size="lg" variant="secondary" className="mt-8" data-testid="button-cta-bottom"><Link href="/sign-up">Open a studio</Link></Button>
        </div>
      </section>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">MonaListen. No analytics, no tracking of visitors.</footer>
    </div>
  );
}
