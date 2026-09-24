import { z } from "zod";
import { badRequest } from "./errors";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationParams {
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const limitSchema = z.coerce.number().int().optional();
  const offsetSchema = z.coerce.number().int().min(0).optional();

  const limitResult = limitSchema.safeParse(query.limit);
  if (!limitResult.success) {
    throw badRequest("Query parameter 'limit' must be an integer");
  }

  const offsetResult = offsetSchema.safeParse(query.offset);
  if (!offsetResult.success) {
    throw badRequest("Query parameter 'offset' must be a non-negative integer");
  }

  let limit = limitResult.data ?? DEFAULT_LIMIT;
  if (limit < 1) {
    throw badRequest("Query parameter 'limit' must be at least 1");
  }
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const offset = offsetResult.data ?? 0;

  return { limit, offset };
}

export function parseSort(
  query: Record<string, unknown>,
  allowedFields: string[],
  defaultField: string
): { field: string; order: "asc" | "desc" } {
  const field = typeof query.sort === "string" ? query.sort : defaultField;
  if (!allowedFields.includes(field)) {
    throw badRequest(`Query parameter 'sort' must be one of: ${allowedFields.join(", ")}`);
  }

  const orderRaw = typeof query.order === "string" ? query.order.toLowerCase() : "asc";
  if (orderRaw !== "asc" && orderRaw !== "desc") {
    throw badRequest("Query parameter 'order' must be 'asc' or 'desc'");
  }

  return { field, order: orderRaw };
}

export function buildMeta(total: number, limit: number, offset: number) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}