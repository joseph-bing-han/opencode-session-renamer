import type { Plugin } from "@opencode-ai/plugin";
import { loadConfig, type SessionRenamerConfig } from "./config";

const SYSTEM_PROMPT = `You are a session title generator. Generate a concise, descriptive title for a coding session based on the user's first message.

Rules:
- Title must be in the same language as the user's message
- Title should capture the main task/topic
- Keep it short and descriptive (max {maxLength} characters)
- No quotes, no punctuation at the end
- Just output the title, nothing else

Examples:
- User: "Help me fix the login bug in auth.ts" -> "Fix login bug"
- User: "I want to refactor the database module" -> "Refactor database module"
- User: "Please optimize this React component's performance" -> "Optimize React component performance"`;

const renamedSessions = new Set<string>();
const lockedSessions = new Set<string>();
const tempSessions = new Set<string>();

const DEFAULT_TITLE_PREFIXES = ["New session - ", "Child session - "];

type ModelRef = { providerID: string; modelID: string };
type SessionClientWithGet = {
  get?: (args: { path: { id: string } }) => Promise<{ data?: { title?: string } }>;
};
type ProvidersConfigPayload = {
  providers: Array<{ id: string; models: Record<string, unknown> }>;
  default: Record<string, string>;
};

let providersConfigPromise: Promise<ProvidersConfigPayload | null> | null = null;

function formatDate(format: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());

  return format
    .replace("YYYY", year.toString())
    .replace("YY", year.toString().slice(-2))
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hours)
    .replace("mm", minutes);
}

function isDefaultTitle(title: string | null | undefined): boolean {
  if (!title || !title.trim()) {
    return true;
  }

  const trimmed = title.trim();
  return DEFAULT_TITLE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function parseModelString(modelStr: string): { providerID: string; modelID: string } {
  const parts = modelStr.split("/");
  if (parts.length >= 2) {
    return { providerID: parts[0], modelID: parts.slice(1).join("/") };
  }
  return { providerID: "opencode", modelID: modelStr };
}

function normalizeConfiguredModel(modelStr: string): ModelRef | null {
  const trimmed = modelStr.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("/");
  if (parts.length >= 2) {
    const providerID = parts[0]?.trim();
    const modelID = parts.slice(1).join("/").trim();
    if (!providerID || !modelID) {
      return null;
    }
    return { providerID, modelID };
  }

  return parseModelString(trimmed);
}

function isProviderModelNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as Record<string, unknown>;
  const name = err.name;
  if (typeof name === "string" && name.toLowerCase().includes("modelnotfound")) {
    return true;
  }

  const message = err.message;
  if (typeof message === "string" && message.toLowerCase().includes("modelnotfound")) {
    return true;
  }

  const data = err.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return typeof d.providerID === "string" && typeof d.modelID === "string";
  }

  return false;
}

async function getProvidersConfig(
  client: Parameters<Plugin>[0]["client"],
  directory: string
): Promise<ProvidersConfigPayload | null> {
  if (!providersConfigPromise) {
    providersConfigPromise = client.config
      .providers({ query: { directory } })
      .then((res) => res.data ?? null)
      .catch(() => null);
  }

  return providersConfigPromise;
}

async function resolveModelForPrompt(
  client: Parameters<Plugin>[0]["client"],
  directory: string,
  configModel: string
): Promise<ModelRef | undefined> {
  const requested = normalizeConfiguredModel(configModel);
  const providersConfig = await getProvidersConfig(client, directory);
  if (!providersConfig) {
    return requested ?? undefined;
  }

  if (!requested) {
    const opencodeProvider = providersConfig.providers.find((p) => p.id === "opencode");
    if (opencodeProvider) {
      const defaultModelID = providersConfig.default?.[opencodeProvider.id];
      if (defaultModelID && opencodeProvider.models?.[defaultModelID]) {
        return { providerID: opencodeProvider.id, modelID: defaultModelID };
      }

      const firstModelID = Object.keys(opencodeProvider.models ?? {})[0];
      if (firstModelID) {
        return { providerID: opencodeProvider.id, modelID: firstModelID };
      }
    }

    for (const provider of providersConfig.providers) {
      const defaultModelID = providersConfig.default?.[provider.id];
      if (defaultModelID && provider.models?.[defaultModelID]) {
        return { providerID: provider.id, modelID: defaultModelID };
      }
    }

    for (const provider of providersConfig.providers) {
      const firstModelID = Object.keys(provider.models ?? {})[0];
      if (firstModelID) {
        return { providerID: provider.id, modelID: firstModelID };
      }
    }

    return undefined;
  }

  const provider = providersConfig.providers.find((p) => p.id === requested.providerID);
  if (provider?.models?.[requested.modelID]) {
    return requested;
  }

  if (provider) {
    const defaultModelID = providersConfig.default?.[provider.id];
    if (defaultModelID && provider.models?.[defaultModelID]) {
      return { providerID: provider.id, modelID: defaultModelID };
    }

    const firstModelID = Object.keys(provider.models ?? {})[0];
    if (firstModelID) {
      return { providerID: provider.id, modelID: firstModelID };
    }
  }

  const opencodeProvider = providersConfig.providers.find((p) => p.id === "opencode");
  if (opencodeProvider) {
    const defaultModelID = providersConfig.default?.[opencodeProvider.id];
    if (defaultModelID && opencodeProvider.models?.[defaultModelID]) {
      return { providerID: opencodeProvider.id, modelID: defaultModelID };
    }

    const firstModelID = Object.keys(opencodeProvider.models ?? {})[0];
    if (firstModelID) {
      return { providerID: opencodeProvider.id, modelID: firstModelID };
    }
  }

  return undefined;
}

function log(config: SessionRenamerConfig, ...args: unknown[]) {
  if (config.debug) {
    console.log("[session-renamer]", ...args);
  }
}

async function generateTitle(
  client: Parameters<Plugin>[0]["client"],
  config: SessionRenamerConfig,
  userMessage: string,
  directory: string
): Promise<string | null> {
  try {
    const resolvedModel = await resolveModelForPrompt(client, directory, config.model);
    if (resolvedModel) {
      log(config, "Using model:", `${resolvedModel.providerID}/${resolvedModel.modelID}`);
    } else {
      log(config, "Using server default model (no explicit model override)");
    }

    const tempSession = await client.session.create({
      body: {},
    });
    
    if (!tempSession.data?.id) {
      console.error("[session-renamer] Failed to create temp session");
      return null;
    }
    
    const tempSessionId = tempSession.data.id;
    tempSessions.add(tempSessionId);
    
    try {
      const promptBodyBase = {
        system: SYSTEM_PROMPT.replace("{maxLength}", config.titleMaxLength.toString()),
        parts: [
          {
            type: "text" as const,
            text: `Generate a title for this message:\n\n${userMessage}`,
          },
        ],
      };

      const doPrompt = async (modelOverride?: ModelRef) =>
        client.session.prompt({
          path: { id: tempSessionId },
          body: modelOverride ? { ...promptBodyBase, model: modelOverride } : promptBodyBase,
        });

      let response: Awaited<ReturnType<typeof doPrompt>>;

      try {
        response = await doPrompt(resolvedModel);
      } catch (error) {
        if (isProviderModelNotFoundError(error)) {
          log(config, "Configured model unavailable, retrying with server default model");
          response = await doPrompt(undefined);
        } else {
          throw error;
        }
      }

      if (!response.data) {
        return null;
      }

      const textPart = response.data.parts?.find((p) => p.type === "text");
      if (!textPart || textPart.type !== "text") {
        return null;
      }

      let title = textPart.text.trim();
      if (title.length > config.titleMaxLength) {
        title = title.slice(0, config.titleMaxLength);
      }

      return title;
    } finally {
      await client.session.delete({ path: { id: tempSessionId } }).catch(() => {});
    }
  } catch (error) {
    console.error("[session-renamer] Failed to generate title:", error);
    return null;
  }
}

const plugin: Plugin = async (ctx) => {
  const config = loadConfig(ctx.directory);
  log(config, "Plugin loaded with config:", config);

  return {
    "chat.message": async (input, output) => {
      const { sessionID } = input;
      const { message, parts } = output;

      log(config, "chat.message hook triggered for session:", sessionID);

      if (tempSessions.has(sessionID)) {
        log(config, "Temp session, skipping:", sessionID);
        return;
      }

      if (renamedSessions.has(sessionID)) {
        log(config, "Session already renamed, skipping:", sessionID);
        return;
      }

      if (lockedSessions.has(sessionID)) {
        log(config, "Session title locked, skipping:", sessionID);
        return;
      }

      const sessionClient = ctx.client.session as SessionClientWithGet;
      if (sessionClient.get) {
        try {
          const sessionInfo = await sessionClient.get({ path: { id: sessionID } });
          const existingTitle = sessionInfo?.data?.title;
          if (!isDefaultTitle(existingTitle)) {
            lockedSessions.add(sessionID);
            log(config, "Session already titled, skipping:", sessionID);
            return;
          }
        } catch (error) {
          log(config, "Failed to read session title:", error);
        }
      }

      let userMessage: string | null = null;

      if (message.summary?.title) {
        userMessage = message.summary.title;
        log(config, "Using message summary title:", userMessage.slice(0, 50) + "...");
      } else if (message.summary?.body) {
        userMessage = message.summary.body;
        log(config, "Using message summary body:", userMessage.slice(0, 50) + "...");
      } else {
        const textPart = parts.find((p: { type: string }) => p.type === "text");
        if (textPart && textPart.type === "text" && "text" in textPart) {
          userMessage = (textPart as { type: "text"; text: string }).text;
          log(config, "Using assistant response:", userMessage.slice(0, 50) + "...");
        }
      }

      if (!userMessage) {
        log(config, "No content found for title generation");
        return;
      }

      if (userMessage.length < config.minMessageLength) {
        log(config, "Message too short, skipping");
        return;
      }

      renamedSessions.add(sessionID);

      setImmediate(async () => {
        try {
          const title = await generateTitle(ctx.client, config, userMessage, ctx.directory);
          if (!title) {
            log(config, "Failed to generate title for session:", sessionID);
            return;
          }

          const dateStr = formatDate(config.dateFormat);
          const fullTitle = `${title}(${dateStr})`;

          await ctx.client.session.update({
            path: { id: sessionID },
            body: { title: fullTitle },
          });

          log(config, "Renamed session:", sessionID, "->", fullTitle);
        } catch (error) {
          console.error("[session-renamer] Failed to rename session:", error);
          renamedSessions.delete(sessionID);
        }
      });
    },
  };
};

// Named export required by opencode plugin system
export const sessionRenamer = plugin;

// Also keep default export for compatibility
export default plugin;
