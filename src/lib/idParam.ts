import { z } from "zod";
import { badRequest } from "./errors";

const uuidSchema = z.string().uuid();

export function parseIdParam(id: string): string {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    throw badRequest("The id in the URL is not a valid identifier");
  }
  return result.data;
}