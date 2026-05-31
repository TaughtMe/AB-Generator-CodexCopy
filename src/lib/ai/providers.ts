import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export type ProviderName = 'openai' | 'google' | 'anthropic' | 'openrouter' | 'lmstudio';

type RuntimeEnv = Record<string, string | undefined>;

type ProviderRuntimeOptions = {
  apiKey?: string;
  baseURL?: string;
  env?: RuntimeEnv;
};

type ProviderFactory = (options?: ProviderRuntimeOptions) => {
  (modelId: string): LanguageModel;
};

const DEFAULT_LM_STUDIO_BASE_URL = 'http://localhost:1234/v1';

function resolveEnvValue(
  options: ProviderRuntimeOptions,
  key: string,
): string | undefined {
  const runtimeValue = options.env?.[key];
  if (runtimeValue && runtimeValue.trim().length > 0) {
    return runtimeValue;
  }

  if (typeof process !== 'undefined' && process.env) {
    const processValue = process.env[key];
    if (processValue && processValue.trim().length > 0) {
      return processValue;
    }
  }

  return undefined;
}

const createOpenAIProvider: ProviderFactory = (options = {}) =>
  createOpenAI({
    apiKey: options.apiKey ?? resolveEnvValue(options, 'OPENAI_API_KEY'),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });

const createGoogleProvider: ProviderFactory = (options = {}) =>
  createGoogleGenerativeAI({
    apiKey: options.apiKey ?? resolveEnvValue(options, 'GOOGLE_GENERATIVE_AI_API_KEY'),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });

const createAnthropicProvider: ProviderFactory = (options = {}) =>
  createAnthropic({
    apiKey: options.apiKey ?? resolveEnvValue(options, 'ANTHROPIC_API_KEY'),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });

const createOpenRouterProvider: ProviderFactory = (options = {}) =>
  createOpenRouter({
    apiKey: options.apiKey ?? resolveEnvValue(options, 'OPENROUTER_API_KEY'),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });

const createLmStudioProvider: ProviderFactory = (options = {}) =>
  createOpenAI({
    apiKey: options.apiKey ?? 'lm-studio',
    baseURL:
      options.baseURL
      ?? resolveEnvValue(options, 'LM_STUDIO_BASE_URL')
      ?? DEFAULT_LM_STUDIO_BASE_URL,
    name: 'lmstudio',
  });

const providerFactories: Record<ProviderName, ProviderFactory> = {
  openai: createOpenAIProvider,
  google: createGoogleProvider,
  anthropic: createAnthropicProvider,
  openrouter: createOpenRouterProvider,
  lmstudio: createLmStudioProvider,
};

function normalizeProviderName(providerName: string): ProviderName {
  const normalized = providerName.trim().toLowerCase();
  if (
    normalized !== 'openai'
    && normalized !== 'google'
    && normalized !== 'anthropic'
    && normalized !== 'openrouter'
    && normalized !== 'lmstudio'
  ) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }
  return normalized;
}

export function getModel(
  providerName: string,
  modelId: string,
  options: ProviderRuntimeOptions = {},
): LanguageModel {
  const normalizedProvider = normalizeProviderName(providerName);
  const provider = providerFactories[normalizedProvider](options);

  return provider(modelId);
}
