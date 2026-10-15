interface PagePlaceholderProps {
  title: string
  description: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-8 shadow-card">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
          SRP Transportation
        </p>
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        <p className="text-base leading-7 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-10 rounded-[24px] border border-dashed border-border-strong bg-muted/60 px-6 py-10 text-sm text-muted-foreground">
        Content for this page will be added in the next steps.
      </div>
    </section>
  )
}