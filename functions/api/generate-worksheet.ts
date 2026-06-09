import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateObject,
  generateText,
  NoObjectGeneratedError,
  type LanguageModel,
} from 'ai';
import { z } from 'zod';
import {
  PLANNER_PROMPT,
  getCreatorPrompt,
  getValidatorPrompt,
  type AfbPromptConfig,
} from '../../src/lib/ai/prompts';
import { getModel } from '../../src/lib/ai/providers';

type EnvBindings = Record<string, unknown>;
type CloudflareFunctionContext = {
  request: Request;
  env?: EnvBindings;
};

const streamPhaseSchema = z.enum(['planning', 'creating', 'validating', 'success', 'error']);

const afbConfigSchema = z.object({
  isActive: z.boolean().default(false),
  reproduktion: z.number().int().min(0).max(100).default(40),
  reorganisation: z.number().int().min(0).max(100).default(30),
  transfer: z.number().int().min(0).max(100).default(20),
  problemloesung: z.number().int().min(0).max(100).default(10),
}).strict();

const requestSchema = z.object({
  input: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  providerApiKey: z.string().min(1).optional(),
  providerBaseURL: z.string().url().optional(),
  afbConfig: afbConfigSchema.optional(),
  stream: z.boolean().optional(),
}).strict();

const plannerOutputSchema = z.object({
  topic: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  learningGoals: z.array(z.string().min(1)),
  difficulty: z.number().min(1).max(5),
}).strict();

const validatorOutputSchema = z.object({
  isValid: z.boolean(),
  score: z.number().min(0).max(100),
  errors: z.array(z.string().min(1)),
}).strict();

const taskItemSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
}).passthrough();

const taskArraySchema = z.array(taskItemSchema).min(1);

const workflowResultSchema = z.object({
  planner: plannerOutputSchema,
  tasks: taskArraySchema,
  validation: validatorOutputSchema,
  afbConfig: afbConfigSchema,
}).strict();

const streamEventSchema = z.object({
  phase: streamPhaseSchema,
  log: z.string().min(1),
  result: workflowResultSchema.optional(),
}).strict();

type StreamEvent = z.infer<typeof streamEventSchema>;
type AgentWorkflowResult = z.infer<typeof workflowResultSchema>;

type DataStreamWriter = {
  writeData: (data: StreamEvent) => void;
};

function pickStringEnv(envBindings: EnvBindings): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(envBindings)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  return env;
}

function createDataStreamResponse(options: {
  execute: (dataStream: DataStreamWriter) => Promise<void> | void;
  onError?: (error: unknown) => string;
}): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const dataStream: DataStreamWriter = {
        writeData: (data) => {
          const safeData = streamEventSchema.parse(data);
          writer.write({
            type: 'data-agent-event',
            id: generateId(),
            data: safeData,
          });
        },
      };

      await options.execute(dataStream);
    },
    onError: options.onError,
  });

  return createUIMessageStreamResponse({ stream });
}

const MAX_CREATOR_RETRIES = 2;
const DEFAULT_API_MAX_TOKENS = 1500;
const CREATOR_API_MAX_TOKENS = 4000;

type CreatorTask = z.infer<typeof taskItemSchema>;

function sanitizeJsonPayload(rawPayload: string): string {
  return rawPayload
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonArrayCandidates(rawText: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < rawText.length; index += 1) {
    const char = rawText[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === ']' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(rawText.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function tryParseJson(payload: string): unknown | null {
  const cleaned = sanitizeJsonPayload(payload);
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function findCreatorTasks(candidate: unknown): CreatorTask[] | null {
  const parsedTasks = taskArraySchema.safeParse(candidate);
  if (parsedTasks.success) {
    return parsedTasks.data;
  }

  if (typeof candidate === 'string') {
    const parsedCandidate = tryParseJson(candidate);
    if (parsedCandidate !== null) {
      const tasks = findCreatorTasks(parsedCandidate);
      if (tasks) return tasks;
    }

    const arrayCandidates = extractJsonArrayCandidates(sanitizeJsonPayload(candidate));
    for (let index = arrayCandidates.length - 1; index >= 0; index -= 1) {
      const parsedArrayCandidate = tryParseJson(arrayCandidates[index]);
      if (parsedArrayCandidate === null) continue;
      const tasks = findCreatorTasks(parsedArrayCandidate);
      if (tasks) return tasks;
    }

    return null;
  }

  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const tasks = findCreatorTasks(entry);
      if (tasks) return tasks;
    }
    return null;
  }

  if (!isRecordObject(candidate)) {
    return null;
  }

  for (const key of ['tasks', 'aufgaben', 'items', 'result', 'data']) {
    if (key in candidate) {
      const tasks = findCreatorTasks(candidate[key]);
      if (tasks) return tasks;
    }
  }

  for (const value of Object.values(candidate)) {
    const tasks = findCreatorTasks(value);
    if (tasks) return tasks;
  }

  return null;
}

function extractJsonArray(text: string): CreatorTask[] {
  const tasks = findCreatorTasks(text);
  if (!tasks) {
    throw new Error('Creator output is not a valid task JSON array.');
  }
  return tasks;
}

function stringifyRepairableCreatorTasks(text: string): string | null {
  const tasks = findCreatorTasks(text);
  return tasks ? JSON.stringify(tasks) : null;
}

function getGeneratedTextFromError(error: unknown): string | null {
  if (NoObjectGeneratedError.isInstance(error) && typeof error.text === 'string') {
    const text = error.text.trim();
    return text.length > 0 ? text : null;
  }

  return null;
}

async function generateCreatorTasks(options: {
  model: LanguageModel;
  system: string;
  prompt: string;
}): Promise<CreatorTask[]> {
  try {
    const creatorResult = await generateObject({
      model: options.model,
      schema: taskItemSchema,
      output: 'array',
      system: options.system,
      prompt: options.prompt,
      maxOutputTokens: CREATOR_API_MAX_TOKENS,
      experimental_repairText: async ({ text }) => stringifyRepairableCreatorTasks(text),
    });

    return taskArraySchema.parse(creatorResult.object);
  } catch (error) {
    const generatedText = getGeneratedTextFromError(error);
    if (generatedText) {
      const repairedTasks = findCreatorTasks(generatedText);
      if (repairedTasks) return repairedTasks;
    }

    if (!NoObjectGeneratedError.isInstance(error)) {
      throw error;
    }
  }

  const creatorResult = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    maxOutputTokens: CREATOR_API_MAX_TOKENS,
  });

  return extractJsonArray(creatorResult.text);
}

async function runAgentWorkflow(
  requestBody: z.infer<typeof requestSchema>,
  onEvent?: (event: StreamEvent) => void,
  runtimeEnv: Record<string, string | undefined> = {},
): Promise<AgentWorkflowResult> {
  const model = getModel(requestBody.provider, requestBody.model, {
    apiKey: requestBody.providerApiKey,
    baseURL: requestBody.providerBaseURL,
    env: runtimeEnv,
  });

  const afbConfig = afbConfigSchema.parse(requestBody.afbConfig ?? {});

  // ── Phase 1: Planner ──
  onEvent?.({
    phase: 'planning',
    log: 'Analysiere Lehrplan und extrahiere Kontext...',
  });

  const plannerResult = await generateObject({
    model,
    schema: plannerOutputSchema,
    system: PLANNER_PROMPT,
    prompt: requestBody.input,
    maxOutputTokens: DEFAULT_API_MAX_TOKENS,
  });

  // ── Phase 2+3: Creator → Validator Loop (max MAX_CREATOR_RETRIES Iterationen) ──
  let tasks: CreatorTask[] = [];
  let validatorResult: z.infer<typeof validatorOutputSchema> = { isValid: false, score: 0, errors: ['Nicht gestartet'] };
  let correctionErrors: string[] = [];

  for (let attempt = 0; attempt < MAX_CREATOR_RETRIES; attempt++) {
    const isRetry = attempt > 0;

    onEvent?.({
      phase: 'creating',
      log: isRetry
        ? `Korrekturschleife ${attempt}/${MAX_CREATOR_RETRIES - 1}: Creator erhält Validator-Feedback...`
        : 'Erzeuge Aufgaben als strukturiertes JSON-Array...',
    });

    const creatorPromptPayload: Record<string, unknown> = {
      planner: plannerResult.object,
      userInput: requestBody.input,
    };

    if (isRetry && correctionErrors.length > 0) {
      creatorPromptPayload.validatorFeedback = correctionErrors;
      creatorPromptPayload.correctionInstruction =
        'Der Validator hat Fehler gemeldet. Korrigiere die Aufgaben und gib erneut ein valides JSON-Array zurueck.';
    }

    try {
      tasks = await generateCreatorTasks({
        model,
        system: getCreatorPrompt(afbConfig as AfbPromptConfig),
        prompt: JSON.stringify(creatorPromptPayload),
      });
    } catch {
      const parseError = 'CREATOR_PARSE_FAIL: Antwort war kein valides JSON-Array.';
      onEvent?.({
        phase: 'error',
        log: parseError,
      });

      if (attempt < MAX_CREATOR_RETRIES - 1) {
        correctionErrors = [parseError];
        continue;
      }

      throw new Error(parseError);
    }

    onEvent?.({
      phase: 'validating',
      log: `Pruefe ${tasks.length} Aufgaben (AFB-Verteilung, Didaktik, Struktur)...`,
    });

    const validatorResponse = await generateObject({
      model,
      schema: validatorOutputSchema,
      system: getValidatorPrompt(afbConfig as AfbPromptConfig),
      prompt: JSON.stringify({
        planner: plannerResult.object,
        tasks,
      }),
      maxOutputTokens: DEFAULT_API_MAX_TOKENS,
    });

    validatorResult = validatorResponse.object;

    if (validatorResult.isValid) {
      onEvent?.({
        phase: 'validating',
        log: `Validierung bestanden (Score: ${validatorResult.score}/100).`,
      });
      break;
    }

    onEvent?.({
      phase: 'validating',
      log: `Validierung fehlgeschlagen (Score: ${validatorResult.score}/100). Fehler: ${validatorResult.errors.join('; ')}`,
    });

    correctionErrors = validatorResult.errors;

    if (attempt >= MAX_CREATOR_RETRIES - 1) {
      onEvent?.({
        phase: 'error',
        log: `Validator-Abbruch nach ${MAX_CREATOR_RETRIES} Versuchen. Letzte Fehler: ${validatorResult.errors.join('; ')}`,
      });
      throw new Error(`Validator-Abbruch nach ${MAX_CREATOR_RETRIES} Versuchen: ${validatorResult.errors.join('; ')}`);
    }
  }

  const parsedTasks = taskArraySchema.parse(tasks);

  return workflowResultSchema.parse({
    planner: plannerResult.object,
    tasks: parsedTasks,
    validation: validatorResult,
    afbConfig,
  });
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
    const requestBody = requestSchema.parse(await request.json());

    if (requestBody.stream !== true) {
      const result = await runAgentWorkflow(requestBody, undefined, runtimeEnv);
      return Response.json(result);
    }

    return createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          const result = await runAgentWorkflow(requestBody, (event) => {
            dataStream.writeData(event);
          }, runtimeEnv);

          const finalLog = result.validation.isValid
            ? 'Arbeitsblatt finalisiert und validiert.'
            : 'Arbeitsblatt erzeugt, Validator meldet Anpassungsbedarf.';

          dataStream.writeData({
            phase: 'success',
            log: finalLog,
            result,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          dataStream.writeData({
            phase: 'error',
            log: `Workflow-Fehler: ${message}`,
          });
          console.error('[functions/api/generate-worksheet] Workflow stream failed:', error);
          throw error;
        }
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[functions/api/generate-worksheet] Stream onError:', error);
        return message;
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    const status = error instanceof z.ZodError ? 400 : 500;
    console.error('[functions/api/generate-worksheet] Request failed:', error);
    return Response.json({ error: message }, { status });
  }
}
