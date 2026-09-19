import type { Metadata } from "next";

const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.vibester.com.br";

interface SharedEvent {
  id: string;
  name: string;
  photoUrl: string | null;
  location: string | null;
  informacoes: string | null;
  startDate: string;
}

async function fetchSharedEvent(id: string): Promise<SharedEvent | null> {
  const res = await fetch(`${API_BASE_URL}/event/events/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const event = await fetchSharedEvent(params.id);
  if (!event) {
    return { title: "Evento não encontrado — Vibester" };
  }
  const description = event.informacoes ?? `${formatDate(event.startDate)} · ${event.location ?? ""}`;
  return {
    title: `${event.name} no Vibester`,
    description,
    openGraph: {
      title: event.name,
      description,
      images: event.photoUrl ? [event.photoUrl] : undefined,
    },
  };
}

export default async function SharedEventPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await fetchSharedEvent(params.id);

  if (!event) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
        <h1 className="text-2xl font-bold">Evento não encontrado</h1>
        <p className="text-muted">Esse rolê pode ter sido removido.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 gap-6">
      <div className="flex flex-col items-center gap-3 bg-surface border border-border rounded-2xl p-8 max-w-sm w-full">
        {event.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.photoUrl}
            alt={event.name}
            className="w-full aspect-[4/5] rounded-xl object-cover border border-border"
          />
        )}
        <h1 className="text-xl font-bold text-center">{event.name}</h1>
        <p className="text-muted text-center capitalize">{formatDate(event.startDate)}</p>
        {event.location && (
          <p className="text-center text-sm text-foreground/80">{event.location}</p>
        )}
        <a
          href={`vibester://event/${event.id}`}
          className="mt-4 w-full text-center rounded-full bg-fire text-white font-bold py-3 hover:bg-fire-dark transition-colors"
        >
          Abrir no Vibester
        </a>
      </div>
    </main>
  );
}
