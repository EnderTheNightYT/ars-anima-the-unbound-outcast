import { createServerFn } from "@tanstack/react-start";
import { questInput } from "@/game/quests";

export const generateQuest = createServerFn({ method: "POST" })
  .inputValidator((input) => questInput.parse(input))
  .handler(async ({ data }) => {
    const { createQuest } = await import("./quests.server");
    return createQuest(data);
  });
