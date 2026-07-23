import { tool } from "@opencode-ai/plugin"

const FALLBACK_MODELS = ["openai/gpt-5.5", "opencode/big-pickle"]
const ATTEMPT_TIMEOUT_MS = 10 * 60 * 1000
const CLEANUP_BATCH_SIZE = 20
const STALE_SESSION_AGE_MS = 60_000
const SUBAGENT_TITLE = /\([^()]*@[^()]+ subagent\)(?: \(fork #\d+\))?$/
const SUBAGENT_FORK = / \(fork #\d+\)$/

function parseModel(value) {
  const separator = value.indexOf("/")
  if (separator < 1 || separator === value.length - 1) throw new Error(`Invalid model: ${value}`)
  return { providerID: value.slice(0, separator), modelID: value.slice(separator + 1) }
}

const formatModel = ({ providerID, modelID }) => `${providerID}/${modelID}`

function requireData(result, message) {
  if (result.error || result.data === undefined) throw new Error(message, { cause: result.error })
  return result.data
}

function timeoutSignal(signal) {
  const timeout = AbortSignal.timeout(5_000)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export default async ({ client, directory }, options = {}) => {
  const attemptTimeoutMs =
    Number.isFinite(options.attemptTimeoutMs) && options.attemptTimeoutMs > 0
      ? options.attemptTimeoutMs
      : ATTEMPT_TIMEOUT_MS
  const sessionWaiters = new Map()

  const deleteSession = async (sessionID, sessionDirectory = directory) => {
    try {
      requireData(
        await client.session.delete({
          path: { id: sessionID },
          query: { directory: sessionDirectory },
          signal: AbortSignal.timeout(5_000),
        }),
        `Unable to delete subagent session ${sessionID}`,
      )
    } catch {
      void client.app
        .log({
          body: {
            service: "subagent-model-fallback",
            level: "warn",
            message: "Unable to delete subagent session",
            extra: { sessionID },
          },
        })
        .catch(() => {})
    }
  }

  try {
    const staleBefore = Date.now() - STALE_SESSION_AGE_MS
    const sessions = requireData(
      await client.session.list({
        query: { directory, search: "subagent", limit: 10_000 },
        signal: AbortSignal.timeout(5_000),
      }),
      "Unable to list existing sessions",
    ).filter(
      (session) =>
        session.time.updated < staleBefore &&
        SUBAGENT_TITLE.test(session.title) &&
        (Boolean(session.parentID) || SUBAGENT_FORK.test(session.title)),
    )
    if (sessions.length) {
      const statuses = requireData(
        await client.session.status({
          query: { directory },
          signal: AbortSignal.timeout(5_000),
        }),
        "Unable to read existing session status",
      )
      const idleSessions = sessions.filter((session) => {
        const status = statuses[session.id]?.type
        return status !== "busy" && status !== "retry"
      })
      for (let index = 0; index < idleSessions.length; index += CLEANUP_BATCH_SIZE) {
        await Promise.all(
          idleSessions
            .slice(index, index + CLEANUP_BATCH_SIZE)
            .map((session) => deleteSession(session.id, session.directory)),
        )
      }
    }
  } catch {
    void client.app
      .log({
        body: {
          service: "subagent-model-fallback",
          level: "warn",
          message: "Unable to delete existing subagent sessions",
        },
      })
      .catch(() => {})
  }

  const watchSession = (sessionID, timeoutMs, signal, accept = () => true) => {
    let timer
    let waiter
    let onAbort
    const cleanup = () => {
      clearTimeout(timer)
      if (onAbort) signal.removeEventListener("abort", onAbort)
      const waiters = sessionWaiters.get(sessionID)
      waiters?.delete(waiter)
      if (waiters?.size === 0) sessionWaiters.delete(sessionID)
    }
    const promise = new Promise((resolve) => {
      waiter = (event) => {
        if (event.type !== "timeout" && !accept(event)) return
        cleanup()
        resolve(event)
      }
      const waiters = sessionWaiters.get(sessionID) ?? new Set()
      waiters.add(waiter)
      sessionWaiters.set(sessionID, waiters)
      timer = setTimeout(() => waiter({ type: "timeout" }), timeoutMs)
      if (signal) {
        onAbort = () => waiter({ type: "aborted" })
        if (signal.aborted) onAbort()
        else signal.addEventListener("abort", onAbort, { once: true })
      }
    })
    return { promise, cancel: cleanup }
  }

  const emitSessionEvent = (sessionID, event) => {
    for (const waiter of sessionWaiters.get(sessionID) ?? []) waiter(event)
  }

  const handleSessionEvent = (event) => {
    if (event.type === "message.updated") {
      const info = event.properties?.info
      if (info?.role === "assistant" && info.error) {
        emitSessionEvent(info.sessionID, { type: "error" })
      }
      return
    }

    const sessionID = event.properties?.sessionID
    if (!sessionID) return
    if (event.type === "session.error") emitSessionEvent(sessionID, { type: "error" })
    if (event.type === "session.status" && event.properties.status?.type === "retry") {
      emitSessionEvent(sessionID, { type: "retry" })
    }
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
    dispose: async () => eventController.abort(),
    event: async ({ event }) => handleSessionEvent(event),
    tool: {
      task: tool({
        description:
          "Launch an allowed subagent. By default, the selected or configured model runs first, then openai/gpt-5.5 and opencode/big-pickle. Pass models for an exact ordered chain with no implicit fallbacks.",
        args: {
          description: tool.schema.string().describe("A short 3-5 word task description"),
          prompt: tool.schema.string().describe("The task for the subagent"),
          subagent_type: tool.schema.string().describe("The subagent to run"),
          command: tool.schema.string().optional().describe("The command that triggered this task"),
          background: tool.schema
            .boolean()
            .optional()
            .describe("Run in the background and notify the parent session when complete"),
          model: tool.schema
            .string()
            .optional()
            .describe("Optional provider/model override for the first attempt"),
          models: tool.schema
            .array(tool.schema.string())
            .min(1)
            .optional()
            .describe("Exact ordered provider/model chain; cannot be combined with model"),
        },
        async execute(args, context) {
          if (args.model && args.models) throw new Error("Pass model or models, not both")

          await context.ask({
            permission: "task",
            patterns: [args.subagent_type],
            always: ["*"],
            metadata: {
              description: args.description,
              subagent_type: args.subagent_type,
              model: args.model,
              models: args.models,
            },
          })

          const agents = requireData(
            await client.app.agents({ query: { directory: context.directory } }),
            "Unable to list agents",
          )
          const agent = agents.find((candidate) => candidate.name === args.subagent_type)
          if (!agent) throw new Error(`${args.subagent_type} is not a valid agent type`)

          const parent = requireData(
            await client.session.get({
              path: { id: context.sessionID },
              query: { directory: context.directory },
            }),
            "Unable to read the parent session",
          )

          const primaryModel = args.model ? parseModel(args.model) : agent.model
          if (!args.models && !primaryModel) {
            throw new Error(`${agent.name} has no configured model; pass model or models explicitly`)
          }

          const models = args.models
            ? args.models.map(parseModel)
            : [primaryModel, ...FALLBACK_MODELS.map(parseModel)].filter(
                (model, index, all) =>
                  all.findIndex((candidate) => formatModel(candidate) === formatModel(model)) ===
                  index,
              )
          const permission = (parent.permission ?? []).filter(
            (rule) => rule.permission === "external_directory" || rule.action === "deny",
          )
          if (!agent.tools?.todowrite) {
            permission.push({ permission: "todowrite", pattern: "*", action: "deny" })
          }
          if (!agent.tools?.task) permission.push({ permission: "task", pattern: "*", action: "deny" })

          const firstModelName = formatModel(models[0])

          const createAttempt = async (modelName) => {
            return requireData(
              await client.session.create({
                body: {
                  parentID: context.sessionID,
                  title: `${args.description} (${modelName} @${agent.name} subagent)`,
                  agent: agent.name,
                  permission,
                },
                query: { directory: context.directory },
              }),
              "Unable to create the subagent session",
            ).id
          }

          const firstSessionID = await createAttempt(firstModelName)

          const render = (state, content, model, attemptedModels) => ({
            title: args.description,
            output: [
              `<task state="${state}">`,
              `<${state === "error" ? "task_error" : "task_result"}>`,
              content,
              `</${state === "error" ? "task_error" : "task_result"}>`,
              "</task>",
            ].join("\n"),
            metadata: {
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

          const readOutput = async (sessionID, existingMessages, signal) => {
            const messages = requireData(
              await client.session.messages({
                path: { id: sessionID },
                query: { directory: context.directory, limit: 100 },
                signal: timeoutSignal(signal),
              }),
              `Unable to read subagent output from ${sessionID}`,
            )
            const latest = messages
              .filter(
                (message) =>
                  message.info.role === "assistant" &&
                  !message.info.error &&
                  !existingMessages.has(message.info.id),
              )
              .sort((left, right) => left.info.time.created - right.info.time.created)
              .at(-1)
            if (!latest) return { found: false }
            return {
              found: true,
              output: latest.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")
                .trim(),
            }
          }

          const runAttempt = async (model, sessionID) => {
            const signal = args.background ? undefined : context.abort
            const stopIfAborted = async () => {
              if (!signal?.aborted) return
              await abortChild(sessionID)
              signal.throwIfAborted()
            }
            await stopIfAborted()
            let before
            try {
              before = requireData(
                await client.session.messages({
                  path: { id: sessionID },
                  query: { directory: context.directory, limit: 100 },
                  signal: timeoutSignal(signal),
                }),
                `Unable to inspect subagent session ${sessionID}`,
              )
            } catch (error) {
              if (signal?.aborted) await stopIfAborted()
              await abortChild(sessionID)
              throw error
            }
            await stopIfAborted()
            const existingMessages = new Set(before.map((message) => message.info.id))
            const deadline = Date.now() + attemptTimeoutMs
            let watcher = watchSession(sessionID, attemptTimeoutMs, signal)
            try {
              const prompted = await client.session.promptAsync({
                path: { id: sessionID },
                query: { directory: context.directory },
                body: {
                  agent: agent.name,
                  model,
                  parts: [{ type: "text", text: args.prompt }],
                },
                signal: timeoutSignal(signal),
              })
              if (prompted.error) {
                watcher.cancel()
                return
              }
            } catch {
              watcher.cancel()
              await abortChild(sessionID)
              if (!args.background && context.abort.aborted) context.abort.throwIfAborted()
              return
            }

            while (true) {
              const event = await watcher.promise
              if (event.type === "aborted") {
                watcher.cancel()
                await abortChild(sessionID)
                context.abort.throwIfAborted()
              }
              if (event.type === "timeout" || event.type === "retry") {
                await abortChild(sessionID)
                return
              }
              if (event.type === "error") return

              const nextWatcher = watchSession(
                sessionID,
                Math.max(1, deadline - Date.now()),
                signal,
              )
              let read
              try {
                read = await readOutput(sessionID, existingMessages, signal)
              } catch (error) {
                nextWatcher.cancel()
                if (signal?.aborted) await stopIfAborted()
                await abortChild(sessionID)
                throw error
              }
              if (signal?.aborted) {
                nextWatcher.cancel()
                await stopIfAborted()
              }
              if (read.found) {
                nextWatcher.cancel()
                return read.output
              }

              watcher = nextWatcher
            }
          }

          const run = async () => {
            const attemptedModels = []
            for (const [index, model] of models.entries()) {
              if (!args.background) context.abort.throwIfAborted()
              const modelName = formatModel(model)
              const sessionID = index === 0 ? firstSessionID : await createAttempt(modelName)
              attemptedModels.push(modelName)
              let output
              try {
                output = await runAttempt(model, sessionID)
              } finally {
                await deleteSession(sessionID, context.directory)
              }
              if (output) return render("completed", output, modelName, attemptedModels)
            }

            return render(
              "error",
              `All subagent models failed: ${attemptedModels.join(", ")}`,
              undefined,
              attemptedModels,
            )
          }

          const notifyParent = async (result) => {
            const parentWatcher = watchSession(
              context.sessionID,
              attemptTimeoutMs,
              undefined,
              (event) => event.type === "idle" || event.type === "error",
            )
            let parentReady = false
            try {
              const status = requireData(
                await client.session.status({
                  query: { directory: context.directory },
                  signal: AbortSignal.timeout(5_000),
                }),
                "Unable to read parent session status",
              )[context.sessionID]
              parentReady = status?.type !== "busy" && status?.type !== "retry"
            } catch {}
            if (parentReady) parentWatcher.cancel()
            else await parentWatcher.promise

            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const notified = await client.session.promptAsync({
                  path: { id: context.sessionID },
                  query: { directory: context.directory },
                  body: {
                    agent: context.agent,
                    parts: [{ type: "text", text: result.output }],
                  },
                  signal: AbortSignal.timeout(5_000),
                })
                if (notified.error) throw new Error("Parent notification was rejected", { cause: notified.error })
                return
              } catch {
                if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500))
              }
            }

            await client.app
              .log({
                body: {
                  service: "subagent-model-fallback",
                  level: "error",
                  message: "Unable to notify parent session of subagent completion",
                  extra: { parentSessionID: context.sessionID },
                },
              })
              .catch(() => {})
          }

          if (!args.background) {
            if (context.abort.aborted) {
              await abortChild(firstSessionID)
              await deleteSession(firstSessionID, context.directory)
              context.abort.throwIfAborted()
            }
            return run()
          }

          void run().then(notifyParent, (error) =>
              notifyParent(
                render(
                  "error",
                  error instanceof Error ? error.message : "Background subagent fallback failed",
                  undefined,
                  [],
                ),
              ),
            )

          return render(
            "running",
            "The task is running in the background. The parent session will be notified when it completes or all models fail.",
            firstModelName,
            [],
          )
        },
      }),
    },
  }
}
