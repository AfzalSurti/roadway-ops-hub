export type PaginationInput = {
  page?: number;
  limit?: number;
};

export type PaginationResult = {
  page: number;
  limit: number;
  skip: number;
};

export function getPagination(input: PaginationInput): PaginationResult {
  const page = Number.isFinite(input.page) && input.page && input.page > 0 ? input.page : 1;
  const limit = Number.isFinite(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 100) : 10;

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}