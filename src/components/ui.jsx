function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

// Небольшой "shadcn-подобный" набор компонентов (без установки shadcn CLI).
// Идея: базовые примитивы + Tailwind классы, которые легко переиспользовать.

export function Button({ className, variant = 'default', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50 hover:brightness-95 active:translate-y-px'
  const variants = {
    default: 'bg-white/20 text-white border border-white/25',
    outline: 'border border-white/35 bg-transparent text-white hover:bg-white/10',
    ghost: 'hover:bg-white/10 text-white',
    destructive: 'bg-red-600/90 text-white hover:bg-red-600 active:brightness-90',
  }
  const sizes = 'h-10 px-6 py-2'
  return <button className={cn(base, variants[variant], sizes, className)} {...props} />
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/50 focus:ring-2 focus:ring-white/20 transition-colors',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/50 focus:ring-2 focus:ring-white/20 transition-colors',
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/25 bg-white/10 backdrop-blur-md shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b border-white/15 px-5 py-4', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function Label({ className, ...props }) {
  return <label className={cn('text-sm font-medium text-white/85', className)} {...props} />
}

export function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-xs text-white/90',
        className,
      )}
      {...props}
    />
  )
}

