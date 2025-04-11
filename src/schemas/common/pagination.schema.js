import { z } from 'zod';

/**
 * Standard pagination schema for query parameters
 * This is used for list endpoints that support pagination
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1)
    .describe('Page number (1-indexed)'),
  limit: z.coerce.number().int().positive().max(100).optional().default(10)
    .describe('Number of items per page (max 100)')
});

/**
 * Pagination result schema for response envelopes
 * This wraps the actual data with pagination metadata
 */
export const paginationResultSchema = z.object({
  data: z.array(z.any())
    .describe('Array of items for the current page'),
  pagination: z.object({
    total: z.number().int().nonnegative()
      .describe('Total number of items across all pages'),
    page: z.number().int().positive()
      .describe('Current page number'),
    limit: z.number().int().positive()
      .describe('Number of items per page'),
    pages: z.number().int().nonnegative()
      .describe('Total number of pages'),
    hasMore: z.boolean()
      .describe('Whether there are more pages after the current one')
  })
});

/**
 * Creates a paginated response schema for a specific item type
 * @param {z.ZodType} itemSchema - Schema for the individual items
 * @returns {z.ZodType} A schema for paginated responses of that item type
 */
export function createPaginatedResponseSchema(itemSchema) {
  return z.object({
    data: z.array(itemSchema)
      .describe('Array of items for the current page'),
    pagination: z.object({
      total: z.number().int().nonnegative()
        .describe('Total number of items across all pages'),
      page: z.number().int().positive()
        .describe('Current page number'),
      limit: z.number().int().positive()
        .describe('Number of items per page'),
      pages: z.number().int().nonnegative()
        .describe('Total number of pages'),
      hasMore: z.boolean()
        .describe('Whether there are more pages after the current one')
    })
  });
} 