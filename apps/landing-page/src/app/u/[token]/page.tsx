import type { Metadata } from "next";

const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.vibester.com.br";

interface ShareProfile {
  accountId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

async function fetchSharedProfile(token: string): Promise<ShareProfile | null> {
  const res = await fetch(`${API_BASE_URL}/user/users/share/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const profile = await fetchSharedProfile(params.token);
  if (!profile) {
    return { title: "Link expirado — Vibester" };
  }
  return {
    title: `${profile.name ?? profile.username} no Vibester`,
    description: profile.bio ?? "Confira este perfil no Vibester.",
  };
}

export default async function SharedProfilePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const profile = await fetchSharedProfile(token);

  if (!profile) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
        <h1 className="text-2xl font-bold">Este link expirou</h1>
        <p className="text-muted">
          Links de compartilhamento do Vibester são válidos por 24 horas.
          Peça para a pessoa gerar um novo link.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 gap-6">
      <div className="flex flex-col items-center gap-3 bg-surface border border-border rounded-2xl p-8 max-w-sm w-full">
        {profile.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.name ?? "Avatar"}
            className="w-24 h-24 rounded-full object-cover border border-border"
          />
        )}
        <h1 className="text-xl font-bold">{profile.name}</h1>
        {profile.username && <p className="text-muted">@{profile.username}</p>}
        {profile.bio && (
          <p className="text-center text-sm text-foreground/80">{profile.bio}</p>
        )}
        <a
          href={`vibester://profile/${token}`}
          className="mt-4 w-full text-center rounded-full bg-fire text-white font-bold py-3 hover:bg-fire-dark transition-colors"
        >
          Abrir no Vibester
        </a>
      </div>
    </main>
  );
}
