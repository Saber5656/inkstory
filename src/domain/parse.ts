import { z } from 'zod';

export class SchemaValidationError extends Error {
  readonly issues: z.ZodIssue[];
  readonly context: string;
  readonly path: string;

  constructor(context: string, issues: z.ZodIssue[]) {
    const first = issues[0];
    const path = first?.path.length ? `/${first.path.join('/')}` : '/';
    super(
      `${context} is invalid at ${path}: ${first?.message ?? 'validation failed'}`,
    );
    this.name = 'SchemaValidationError';
    this.context = context;
    this.issues = issues;
    this.path = path;
  }
}

export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new SchemaValidationError(context, result.error.issues);
  return result.data as z.infer<T>;
}
