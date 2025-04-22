import { tool } from "ai";
import { z } from "zod";

export const today = tool({
  description: "Get the current date, use this tool to get the current date and time. You can also use it to calculate future dates like tomorrow, next week, next month, next year, next decade",
  parameters: z.object({}),
  execute() {
    const date = new Date();
    return Promise.resolve(date.toISOString());
  }
})
