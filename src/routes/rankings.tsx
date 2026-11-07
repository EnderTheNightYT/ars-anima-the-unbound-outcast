import { createFileRoute, Link } from "@tanstack/react-router";
import { MpBoard } from "@/game/WorldBoard";

export const Route = createFileRoute("/rankings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ranking PvP online — ARS ANIMA" },
      { name: "description", content: "Clasificación pública de las partidas multijugador de ARS ANIMA: puntuación, victorias, bajas y traiciones." },
      { property: "og:title", content: "Ranking PvP online — ARS ANIMA" },
      { property: "og:description", content: "Clasificación pública de las partidas multijugador de ARS ANIMA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <main className="min-h-screen bg-background text-foreground p-4 max-w-3xl mx-auto grid gap-3 content-start">
      <h1 className="font-pixel text-lg text-rarity-2">RANKING MULTIJUGADOR</h1>
      <Link to="/" className="text-xs underline text-muted-foreground">← Volver al juego</Link>
      <MpBoard me={undefined} />
    </main>
  ),
});
