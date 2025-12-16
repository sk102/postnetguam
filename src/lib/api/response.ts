import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  const init: ResponseInit = { status };
  if (headers) {
    init.headers = headers;
  }
  return NextResponse.json({ success: true, data }, init);
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown[]
): NextResponse<ApiErrorResponse> {
  const error: ApiErrorResponse['error'] = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return NextResponse.json({ success: false, error }, { status });
}

export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta
): NextResponse<ApiPaginatedResponse<T>> {
  return NextResponse.json({ success: true, data, pagination });
}

// Common error responses
export function notFoundResponse(resource: string): NextResponse<ApiErrorResponse> {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404);
}

export function badRequestResponse(
  message: string,
  details?: unknown[]
): NextResponse<ApiErrorResponse> {
  return errorResponse('BAD_REQUEST', message, 400, details);
}

export function unauthorizedResponse(): NextResponse<ApiErrorResponse> {
  return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
}

export function forbiddenResponse(): NextResponse<ApiErrorResponse> {
  return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
}

export function internalErrorResponse(message = 'Internal server error'): NextResponse<ApiErrorResponse> {
  return errorResponse('INTERNAL_ERROR', message, 500);
}
