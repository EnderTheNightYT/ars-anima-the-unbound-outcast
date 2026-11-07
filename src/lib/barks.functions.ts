import { createServerFn } from "@tanstack/react-start";
import { barkInput } from "@/game/barks";

export const generateBarks = createServerFn({ method: "POST" })
  .inputValidator((input) => barkInput.parse(input))
  .handler(async ({ data }) => {
    const { createBarks } = await import("./barks.server");
    return createBarks(data);
  });
