import type { ZodType } from 'zod';
import type { GemmaClient } from '../gemma/client';
import type { GenerateRequest } from '../gemma/protocol';
import { extractJson } from './extract-json';

export type StructuredRequest = Omit<GenerateRequest, 'id'>;

export interface StructuredOptions<T> {
  schema: ZodType<T>;
  /** Short description of the keys, used if the first answer needs repairing. */
  shape: string;
  onToken?: (chunk: string) => void;
}

/** Parses model text against the schema. Null when there's no JSON or it doesn't fit. */
export function parseStructured<T>(text: string, schema: ZodType<T>): T | null {
  const json = extractJson(text);
  if (json === null) return null;
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}

/**
 * Gemma output -> extract JSON -> Zod. If that fails, one text-only repair pass that
 * hands Gemma its own answer back. Returns null instead of throwing so callers can
 * fall back, because a bad generation should never dead-end the game loop.
 */
export async function generateStructured<T>(
  gemma: GemmaClient,
  request: StructuredRequest,
  { schema, shape, onToken }: StructuredOptions<T>,
): Promise<T | null> {
  const first = await gemma.generate(request, onToken);
  const parsed = parseStructured(first.text, schema);
  if (parsed !== null) return parsed;

  const repair = await gemma.generate({
    system: 'You fix broken JSON. Reply with one valid JSON object and nothing else.',
    prompt: `Rewrite this as valid JSON with these keys: ${shape}\n\n${first.text.slice(0, 1500)}`,
    maxTokens: request.maxTokens,
  });
  return parseStructured(repair.text, schema);
}
