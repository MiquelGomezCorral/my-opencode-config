import { tool } from "@opencode-ai/plugin"

const FALLBACK_MODELS = ["openai/gpt-5.5", "opencode/big-pickle"]
const ATTEMPT_TIMEOUT_MS = 10 * 60 * 1000

function parseModel(value) {
  const separator = value.indexOf("/")
  if (separator < 1 || separator === value.length - 1) throw new Error(`Invalid model: ${value}`)
  return { providerID: value.slice(0, separator), modelID: value.slice(separator + 1) }
}

export default async ({ client, directory }, options = {}) => {
  const attemptTimeoutMs =
    Number.isFinite(options.attemptTimeoutMs) && options.attemptTimeoutMs > 0
      ? options.attemptTimeoutMs
      : ATTEMPT_TIMEOUT_MS
  const sessionWaiters = new Map()

  const watchSession = (sessionID, timeoutMs) => {
    let timer
    let waiter
    const cleanup = () => {
      clearTimeout(timer)
      const waiters = sessionWaiters.get(sessionID)
      waiters?.delete(waiter)
      if (waiters?.size === 0) sessionWaiters.delete(sessionID)
    }
    const promise = new Promise((resolve) => {
      waiter = (event) => {
        cleanup()
        resolve(event)
      }
      const waiters = sessionWaiters.get(sessionID) ?? new Set()
      waiters.add(waiter)
      sessionWaiters.set(sessionID, waiters)
      timer = setTimeout(() => waiter({ type: "timeout" }), timeoutMs)
    })
    return { promise, cancel: cleanup }
  }

  const emitSessionEvent = (sessionID, event) => {
    for (const waiter of sessionWaiters.get(sessionID) ?? []) waiter(event)
  }

  const handleSessionEvent = (event) => {
    const sessionID = event.properties?.sessionID
    if (!sessionID) return
    if (event.type === "session.error") emitSessionEvent(sessionID, { type: "error" })
    if (event.type === "session.idle") emitSessionEvent(sessionID, { type: "idle" })
  }

  const eventController = new AbortController()
  const subscribed = await client.event.subscribe({
    query: { directory },
    signal: eventController.signal,
  })
  void (async () => {
    try {
      for await (const event of subscribed.stream) handleSessionEvent(event)
    } catch {
      if (!eventController.signal.aborted) {
        await client.app.log({
          body: {
            service: "subagent-model-fallback",
            level: "error",
            message: "Subagent event stream disconnected",
          },
        })
      }
    }
  })()

  return {
    dispose: () => eventController.abort(),
    event: async ({ event }) => handleSessionEvent(event),
    config: (cfg) => {
      cfg.agent ??= {}
      cfg.agent.explore ??= {}
      cfg.agent.general ??= {}

      cfg.agent.explore.model = "opencode/big-pickle"
      cfg.agent.general.model = "opencode/deepseek-v4-pro"
    },
    tool: {
      task: tool({
        description:
          "Launch or resume an allowed subagent. The selected or configured model runs first, then failures automatically fall back to openai/gpt-5.5 and opencode/big-pickle.",
        args: {
          description: tool.schema.string().describe("A short 3-5 word task description"),
          prompt: tool.schema.string().describe("The task for the subagent"),
          subagent_type: tool.schema.string().describe("The subagent to run"),
          task_id: tool.schema.string().optional().describe("Existing child session ID to resume"),
          command: tool.schema.string().optional().describe("The command that triggered this task"),
          background: tool.schema
            .boolean()
            .optional()
            .describe("Run in the background and notify the parent session when complete"),
          model: tool.schema
            .string()
            .optional()
            .describe("Optional provider/model override for the first attempt"),
        },
        async execute(args, context) {
          await context.ask({
            permission: "task",
            patterns: [args.subagent_type],
            always: ["*"],
            metadata: {
              description: args.description,
              subagent_type: args.subagent_type,
              model: args.model,
            },
          })

          const agents = await client.app.agents({ query: { directory: context.directory } })
          const agent = agents.data?.find((candidate) => candidate.name === args.subagent_type)
          if (!agent) throw new Error(`${args.subagent_type} is not a valid agent type`)

          const parent = await client.session.get({
            path: { id: context.sessionID },
            query: { directory: context.directory },
          })
          if (!parent.data) throw new Error("Unable to read the parent session")

          const primaryModel = args.model ? parseModel(args.model) : agent.model
          if (!primaryModel) throw new Error(`${agent.name} has no configured model; pass model explicitly`)

          const models = [primaryModel, ...FALLBACK_MODELS.map(parseModel)].filter(
            (model, index, all) =>
              all.findIndex(
                (candidate) =>
                  candidate.providerID === model.providerID && candidate.modelID === model.modelID,
              ) === index,
          )
          const permission = [
            ...(parent.data.permission ?? []).filter(
              (rule) => rule.permission === "external_directory" || rule.action === "deny",
            ),
            ...(agent.tools?.todowrite
              ? []
              : [{ permission: "todowrite", pattern: "*", action: "deny" }]),
            ...(agent.tools?.task
              ? []
              : [{ permission: "task", pattern: "*", action: "deny" }]),
          ]

          const createChild = async (modelName) => {
            const created = await client.session.create({
              body: {
                parentID: context.sessionID,
                title: `${args.description} (${modelName} @${agent.name} subagent)`,
                agent: agent.name,
                permission,
              },
              query: { directory: context.directory },
            })
            if (!created.data) throw new Error("Unable to create the subagent session")
            return created.data.id
          }

          const firstModelName = `${models[0].providerID}/${models[0].modelID}`
          const firstSessionID = args.task_id ?? (await createChild(firstModelName))

          const render = (state, content, model, attemptedModels, sessionID, sessionIds) => ({
            title: args.description,
            output: [
              `<task id="${sessionID}" state="${state}">`,
              `<${state === "error" ? "task_error" : "task_result"}>`,
              content,
              `</${state === "error" ? "task_error" : "task_result"}>`,
              "</task>",
            ].join("\n"),
            metadata: {
              sessionId: sessionID,
              sessionIds,
              model,
              attemptedModels,
              ...(args.background ? { background: true } : {}),
            },
          })

          const abortChild = async (sessionID) => {
            try {
              await client.session.abort({
                path: { id: sessionID },
                query: { directory: context.directory },
                signal: AbortSignal.timeout(5_000),
              })
            } catch {}
          }

          const readOutput = async (sessionID, existingMessages) => {
            try {
              const messages = await client.session.messages({
                path: { id: sessionID },
                query: { directory: context.directory, limit: 100 },
                signal: AbortSignal.timeout(5_000),
              })
              const latest = (messages.data ?? [])
                .filter(
                  (message) =>
                    message.info.role === "assistant" &&
                    !message.info.error &&
                    !existingMessages.has(message.info.id),
                )
                .sort((left, right) => left.info.time.created - right.info.time.created)
                .at(-1)
              return latest?.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")
                .trim()
            } catch {}
          }

          const runAttempt = async (model, sessionID) => {
            let existingMessages
            try {
              const before = await client.session.messages({
                path: { id: sessionID },
                query: { directory: context.directory, limit: 100 },
                signal: AbortSignal.timeout(5_000),
              })
              existingMessages = new Set((before.data ?? []).map((message) => message.info.id))
            } catch {
              return
            }
            const watcher = watchSession(sessionID, attemptTimeoutMs)
            try {
              const prompted = await client.session.promptAsync({
                path: { id: sessionID },
                query: { directory: context.directory },
                body: {
                  agent: agent.name,
                  model,
                  parts: [{ type: "text", text: args.prompt }],
                },
                signal: AbortSignal.timeout(5_000),
              })
              if (prompted.error) {
                watcher.cancel()
                return
              }
            } catch {
              watcher.cancel()
              await abortChild(sessionID)
              return
            }

            const event = await watcher.promise
            if (event.type === "timeout") {
              await abortChild(sessionID)
              return
            }
            if (event.type === "error") return
            return readOutput(sessionID, existingMessages)
          }

          const run = async () => {
            const attemptedModels = []
            const sessionIds = []
            for (const [index, model] of models.entries()) {
              const modelName = `${model.providerID}/${model.modelID}`
              const sessionID = index === 0 ? firstSessionID : await createChild(modelName)
              attemptedModels.push(modelName)
              sessionIds.push(sessionID)
              const output = await runAttempt(model, sessionID)
              if (output) {
                return render("completed", output, modelName, attemptedModels, sessionID, sessionIds)
              }
            }

            return render(
              "error",
              `All subagent models failed: ${attemptedModels.join(", ")}`,
              undefined,
              attemptedModels,
              sessionIds.at(-1),
              sessionIds,
            )
          }

          const notifyParent = async (result) => {
            const parentWatcher = watchSession(context.sessionID, attemptTimeoutMs)
            try {
              const statuses = await client.session.status({
                query: { directory: context.directory },
                signal: AbortSignal.timeout(5_000),
              })
              if (statuses.data?.[context.sessionID]) {
                await parentWatcher.promise
              } else {
                parentWatcher.cancel()
              }
            } catch {
              parentWatcher.cancel()
            }

            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                await client.session.promptAsync({
                  path: { id: context.sessionID },
                  query: { directory: context.directory },
                  body: {
                    agent: context.agent,
                    parts: [{ type: "text", text: result.output }],
                  },
                  signal: AbortSignal.timeout(5_000),
                })
                return
              } catch {
                if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500))
              }
            }

            await client.app.log({
              body: {
                service: "subagent-model-fallback",
                level: "error",
                message: "Unable to notify parent session of subagent completion",
                extra: { parentSessionID: context.sessionID },
              },
            })
          }

          if (!args.background) return run()

          void run()
            .then(notifyParent)
            .catch((error) =>
              notifyParent(
                render(
                  "error",
                  error instanceof Error ? error.message : "Background subagent fallback failed",
                  undefined,
                  [],
                  firstSessionID,
                  [firstSessionID],
                ),
              ),
            )

          return render(
            "running",
            "The task is running in the background. The parent session will be notified when it completes or all models fail.",
            firstModelName,
            [],
            firstSessionID,
            [firstSessionID],
          )
        },
      }),
    },
  }
}
