import { createFileRoute } from "@tanstack/react-router";
import GameView from "@/game/GameView";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ars. Anima. : - \" IL'INCONNU. \" — FPS retro jugable" },
      { name: "description", content: "ARS ANIMA: \"IL'INCONNU\" — FPS retro soulslike roguelite con parkour, remates, pactos y supervivencia. Juega en PC y celular." },
      { property: "og:title", content: "ARS ANIMA: \"IL'INCONNU\" — Demo jugable" },
      { property: "og:description", content: "ARS ANIMA: \"IL'INCONNU\" — FPS retro roguelite con parkour, remates y botín aleatorio." },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameView,
});
