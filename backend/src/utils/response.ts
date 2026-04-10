// src/utils/response.ts
import { Response } from 'express';
import { ApiResponse } from '../types';

export function success<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: any
): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T, message = 'Created'): Response {
  return success(res, data, message, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
): Response {
  const total_pages = Math.ceil(total / limit);
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      total,
      page,
      limit,
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1,
    },
  });
}

// ─── AppError ─────────────────────────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: any[];

  constructor(message: string, statusCode = 500, errors?: any[]) {
    super(message);
    this.statusCode    = statusCode;
    this.isOperational = true;
    this.errors        = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string, errors?: any[])  { return new AppError(msg, 400, errors); }
  static unauthorized(msg = 'Unauthorized')        { return new AppError(msg, 401); }
  static forbidden(msg = 'Forbidden')              { return new AppError(msg, 403); }
  static notFound(msg = 'Not found')               { return new AppError(msg, 404); }
  static conflict(msg: string)                     { return new AppError(msg, 409); }
  static unprocessable(msg: string, errors?: any[]){ return new AppError(msg, 422, errors); }
  static internal(msg = 'Internal server error')   { return new AppError(msg, 500); }
}