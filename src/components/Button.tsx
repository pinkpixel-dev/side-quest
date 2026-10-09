import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Link } from '../app/router';

type Variant = 'primary' | 'secondary' | 'paper' | 'ghost' | 'danger';

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 font-semibold ' +
  'transition-[background-color,border-color,color,transform,opacity] duration-150 ease-out ' +
  'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-moss text-moss-ink hover:bg-moss-2',
  secondary: 'border border-ink-3 text-snow hover:bg-ink-2 hover:border-fog/40',
  paper: 'border border-bark/20 text-bark hover:bg-paper-2',
  ghost: 'text-fog hover:text-snow hover:bg-ink-2',
  danger: 'bg-blush text-blush-ink hover:bg-blush/85',
};

export const buttonClass = (variant: Variant = 'primary', extra = '') => `${base} ${variants[variant]} ${extra}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', loading, icon, children, className = '', disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonClass(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  icon,
  children,
  className = '',
}: {
  href: string;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {icon}
      {children}
    </Link>
  );
}
