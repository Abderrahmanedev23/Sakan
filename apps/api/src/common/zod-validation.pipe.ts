import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ValidationErrorBody } from '@sakan/shared';
import type { z } from 'zod';

/** Validates and transforms a request body with a shared zod schema. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const body: ValidationErrorBody = {
      statusCode: 400,
      message: 'Some fields are invalid',
      errors: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    };
    throw new BadRequestException(body);
  }
}
