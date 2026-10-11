import { Link } from 'wouter';
export function Logo({ light = false, href = '/' }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" data-testid="link-logo">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-8 w-8" />
      <span className={`font-display text-xl font-semibold ${light ? 'text-[hsl(38_30%_92%)]' : ''}`}>
        Mona<span className="text-primary">Listen</span>
      </span>
    </Link>
  );
}
