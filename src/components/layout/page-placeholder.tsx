interface PagePlaceholderProps {
  title: string
  description: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="rounded-[28px] border border-sky-100 bg-white p-8 shadow-[0_20px_60px_-45px_rgba(14,116,144,0.45)]">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
          SRP Transportation
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="text-base leading-7 text-slate-500">{description}</p>
      </div>

      <div className="mt-10 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/60 px-6 py-10 text-sm text-slate-500">
        Content for this page will be added in the next steps.
      </div>
    </section>
  )
}