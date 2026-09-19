import type { Metadata } from "next";

const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.vibester.com.br";

interface SharedPlace {
  id: string;
  name: string;
  bio: string | null;
  endereco: string | null;
  photoUrl: string | null;
  category: string;
}

async function fetchSharedPlace(id: string): Promise<SharedPlace | null> {
  const res = await fetch(
    `${API_BASE_URL}/establishment/establishments/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const place = await fetchSharedPlace(params.id);
  if (!place) {
    return { title: "Lugar não encontrado — Vibester" };
  }
  const description = place.bio ?? place.endereco ?? "Confira este lugar no Vibester.";
  return {
    title: `${place.name} no Vibester`,
    description,
    openGraph: {
      title: place.name,
      description,
      images: place.photoUrl ? [place.photoUrl] : undefined,
    },
  };
}

export default async function SharedPlacePage({
  params,
}: {
  params: { id: string };
}) {
  const place = await fetchSharedPlace(params.id);

  if (!place) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
        <h1 className="text-2xl font-bold">Lugar não encontrado</h1>
        <p className="text-muted">Esse lugar pode ter sido removido.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 gap-6">
      <div className="flex flex-col items-center gap-3 bg-surface border border-border rounded-2xl p-8 max-w-sm w-full">
        {place.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.photoUrl}
            alt={place.name}
            className="w-24 h-24 rounded-full object-cover border border-border"
          />
        )}
        <h1 className="text-xl font-bold text-center">{place.name}</h1>
        {place.category && <p className="text-muted">{place.category}</p>}
        {place.endereco && (
          <p className="text-center text-sm text-foreground/80">{place.endereco}</p>
        )}
        {place.bio && (
          <p className="text-center text-sm text-foreground/80">{place.bio}</p>
        )}
        <a
          href={`vibester://place/${place.id}`}
          className="mt-4 w-full text-center rounded-full bg-fire text-white font-bold py-3 hover:bg-fire-dark transition-colors"
        >
          Abrir no Vibester
        </a>
      </div>
    </main>
  );
}
