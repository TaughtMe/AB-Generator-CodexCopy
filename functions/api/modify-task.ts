import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '../../src/lib/ai/providers';

type EnvBindings = Record<string, unknown>;
type CloudflareFunctionContext = {
  request: Request;
  env?: EnvBindings;
};

const providerSchema = z.enum(['openai', 'google', 'openrouter', 'lmstudio']);

const microTaskSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  content: z.string().optional(),
  text: z.string().optional(),
  question: z.string().optional(),
  options: z.array(z.object({}).passthrough()).optional(),
  vocabulary: z.array(z.object({}).passthrough()).optional(),
}).passthrough();

const requestSchema = z.object({
  task: microTaskSchema,
  instruction: z.string().min(1),
  provider: providerSchema,
  model: z.string().min(1),
  providerApiKey: z.string().min(1).optional(),
  providerBaseURL: z.string().url().optional(),
}).strict();

const MODIFY_TASK_SYSTEM_PROMPT = `Du bist ein präziser Editor für einzelne Arbeitsblatt-Aufgaben.
Antworte ausschließlich mit einem validen JSON-Objekt, das exakt dem Aufgabenformat entspricht.
Behalte den ursprünglichen "type" bei.
Ändere nur den 'content'-Bereich. Halte die Formatierung exakt bei. Fasse dich extrem kurz, um Token zu sparen.
Keine Markdown-Blöcke. Keine Erklärtexte.`;

function pickStringEnv(envBindings: EnvBindings): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(envBindings)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  return env;
}

export async function onRequest(context: CloudflareFunctionContext): Promise<Response> {
  const { request } = context;
  const runtimeEnv = pickStringEnv(context.env ?? {});

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  try {
    const body = requestSchema.parse(await request.json());

    const model = getModel(body.provider, body.model, {
      apiKey: body.providerApiKey,
      baseURL: body.providerBaseURL,
      env: runtimeEnv,
    });

    const result = await generateObject({
      model,
      schema: microTaskSchema,
      system: MODIFY_TASK_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        task: body.task,
        instruction: body.instruction,
      }),
      maxOutputTokens: 1500,
    });

    return Response.json(result.object);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof Error ? error.message : 'Invalid request';
    console.error('[functions/api/modify-task] Request failed:', error);
    return Response.json({ error: message }, { status });
  }
}
