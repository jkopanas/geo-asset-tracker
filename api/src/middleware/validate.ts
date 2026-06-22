import { type RequestHandler } from 'express';
import { type ZodSchema } from 'zod';
import { ValidationError } from '../errors/app-errors.js';

declare global {
  namespace Express {
    interface Request {
      validated: unknown;
    }
  }
}

export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const fields: Record<string, string> = {};
      for (const [key, messages] of Object.entries(fieldErrors)) {
        if (messages && messages.length > 0) {
          fields[key] = messages[0];
        }
      }
      throw new ValidationError('Request body is invalid.', fields);
    }

    req.validated = result.data;
    next();
  };
}
