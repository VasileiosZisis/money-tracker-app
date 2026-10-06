export function SectionHeading({ id, title }: { id: string; title: string }) {
  return <h2 id={id} className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>;
}
