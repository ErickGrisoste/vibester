import type { ReactNode } from "react";

export const CONTACT_EMAIL = "contato@vibester.com.br";

const NAV = [
  { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/suporte", label: "Suporte" },
];

/**
 * Casca das páginas institucionais (termos, privacidade, suporte).
 *
 * São páginas de leitura: sem animação, texto em coluna estreita e links
 * cruzados entre elas. O app abre estes endereços dentro do navegador do
 * sistema, então precisam funcionar bem em tela de celular.
 */
export default function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <article className="mx-auto max-w-2xl">
        <a href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-vibester.svg" alt="Vibester" className="h-6 w-auto" />
        </a>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{title}</h1>
        {updatedAt && (
          <p className="text-muted text-sm mb-10">Última atualização: {updatedAt}</p>
        )}

        <div className="legal-content space-y-6 text-[15px] leading-7 text-foreground/90">
          {children}
        </div>

        <nav className="mt-16 pt-8 border-t border-border flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-muted hover:text-fire transition-colors">
              {item.label}
            </a>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-muted hover:text-fire transition-colors">
            {CONTACT_EMAIL}
          </a>
        </nav>
      </article>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground pt-4">{title}</h2>
      {children}
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-fire underline underline-offset-4">
      {CONTACT_EMAIL}
    </a>
  );
}
