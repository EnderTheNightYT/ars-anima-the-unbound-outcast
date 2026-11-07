import { createServerFn } from "@tanstack/react-start";
import { padAdviceInput } from "@/game/pad-mapping";

export const suggestPadMap = createServerFn({ method: "POST" })
  .inputValidator((input) => padAdviceInput.parse(input))
  .handler(async ({ data }) => {
    const { proposePadMap } = await import("./pad-advice.server");
    return proposePadMap(data);
  });
