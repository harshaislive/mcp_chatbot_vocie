// models.ts
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";
import { ChatModel } from "app-types/chat";

// Azure OpenAI configuration
const azureOpenAI = createOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
});

const staticModels = {
  azure: {
    [process.env.AZURE_OPENAI_DEPLOYMENT || "o3-mini"]: azureOpenAI(
      process.env.AZURE_OPENAI_DEPLOYMENT || "o3-mini",
    ),
  },
};

const staticUnsupportedModels = new Set();

const allModels = staticModels;

const allUnsupportedModels = staticUnsupportedModels;

export const isToolCallUnsupportedModel = (model: LanguageModel) => {
  return allUnsupportedModels.has(model);
};

const firstProvider = Object.keys(allModels)[0];
const firstModel = Object.keys(allModels[firstProvider])[0];

const fallbackModel = allModels[firstProvider][firstModel];

export const customModelProvider = {
  modelsInfo: Object.entries(allModels).map(([provider, models]) => ({
    provider,
    models: Object.entries(models).map(([name, model]) => ({
      name,
      isToolCallUnsupported: isToolCallUnsupportedModel(model),
    })),
  })),
  getModel: (model?: ChatModel): LanguageModel => {
    if (!model) return fallbackModel;
    return allModels[model.provider]?.[model.model] || fallbackModel;
  },
};
