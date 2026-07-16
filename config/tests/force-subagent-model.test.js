import { describe, expect, test } from "bun:test"
import forceSubagentModel from "../plugins/force-subagent-model.js"

function response(text, error) {
  return { error, text }
}

function sdkError(error) {
  return { sdkError: error }
}

async function setup(responses, attemptTimeoutMs = 50, parentActive = false) {
  const calls = []
  const aborted = []
  const messages = new Map()
  const eventQueue = []
  let child = 0
  let receiveEvent
  let notify
  const notified = new Promise((resolve) => {
    notify = resolve
  })
  const emitEvent = (event) =>
    new Promise((resolve) => {
      const queued = { event, resolve }
      if (receiveEvent) {
        const receive = receiveEvent
        receiveEvent = undefined
        receive(queued)
      } else {
        eventQueue.push(queued)
      }
    })
  const eventStream = (async function* () {
    while (true) {
      const queued =
        eventQueue.shift() ?? (await new Promise((resolve) => (receiveEvent = resolve)))
      yield queued.event
      queued.resolve()
    }
  })()
  const client = {
    event: {
      subscribe: async () => ({ stream: eventStream }),
    },
    app: {
      log: async () => ({ data: true }),
      agents: async () => ({
        data: [
          {
            name: "explore",
            model: { providerID: "opencode", modelID: "deepseek-v4-pro" },
            tools: {},
          },
        ],
      }),
    },
    session: {
      get: async () => ({ data: { permission: [] } }),
      create: async () => ({ data: { id: `child-${++child}` } }),
      abort: async (request) => {
        aborted.push(request.path.id)
        return { data: true }
      },
      messages: async (request) => ({ data: messages.get(request.path.id) ?? [] }),
      status: async () => {
        if (parentActive) {
          queueMicrotask(() => {
            void emitEvent({ type: "session.idle", properties: { sessionID: "parent-session" } })
          })
        }
        return { data: parentActive ? { "parent-session": { type: "busy" } } : {} }
      },
      promptAsync: async (request) => {
        if (request.path.id === "parent-session") {
          notify(request)
          return { data: undefined }
        }

        const sessionID = request.path.id
        calls.push(`${request.body.model.providerID}/${request.body.model.modelID}`)
        const next = responses.shift()
        if (next === "hang") return { data: undefined }
        if (next instanceof Error) throw next
        if (next.sdkError) return { error: next.sdkError }
        if (next.error) {
          await emitEvent({
            type: "session.error",
            properties: { sessionID, error: next.error },
          })
          return { data: undefined }
        }

        messages.set(sessionID, [
          ...(messages.get(sessionID) ?? []),
          {
            info: {
              id: `message-${sessionID}`,
              role: "assistant",
              time: { created: Date.now() },
              finish: "stop",
            },
            parts: next.text === undefined ? [] : [{ type: "text", text: next.text }],
          },
        ])
        await emitEvent({ type: "session.idle", properties: { sessionID } })
        return { data: undefined }
      },
    },
  }
  const plugin = await forceSubagentModel({ client, directory: "/tmp/project" }, { attemptTimeoutMs })
  const context = {
    abort: new AbortController().signal,
    agent: "build",
    ask: async () => {},
    directory: "/tmp/project",
    sessionID: "parent-session",
  }

  return { aborted, calls, context, messages, notified, task: plugin.tool.task }
}

const args = {
  description: "Inspect code",
  prompt: "Inspect the code and report.",
  subagent_type: "explore",
}

describe("force subagent model", () => {
  test("falls back from the configured model to OpenAI", async () => {
    const { calls, context, task } = await setup([
      sdkError({ name: "ProviderError" }),
      response("Recovered"),
    ])

    const result = await task.execute(args, context)

    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(result.metadata.model).toBe("openai/gpt-5.5")
    expect(result.metadata.sessionIds).toEqual(["child-1", "child-2"])
    expect(result.output).toContain('state="completed"')
  })

  test("uses an explicitly selected model first", async () => {
    const { calls, context, task } = await setup([response("Selected model worked")])

    const result = await task.execute({ ...args, model: "openai/gpt-5.6-luna" }, context)

    expect(calls).toEqual(["openai/gpt-5.6-luna"])
    expect(result.metadata.model).toBe("openai/gpt-5.6-luna")
  })

  test("ignores output from a resumed session's earlier messages", async () => {
    const { context, messages, task } = await setup([response("Current result")])
    messages.set("existing-session", [
      {
        info: {
          id: "old-message",
          role: "assistant",
          time: { created: 1 },
          finish: "stop",
        },
        parts: [{ type: "text", text: "Stale result" }],
      },
    ])

    const result = await task.execute({ ...args, task_id: "existing-session" }, context)

    expect(result.output).toContain("Current result")
    expect(result.output).not.toContain("Stale result")
  })

  test("reports an error after every model fails", async () => {
    const { calls, context, task } = await setup([
      response(""),
      response(undefined, { name: "ProviderError" }),
      new Error("network failed"),
    ])

    const result = await task.execute(args, context)

    expect(calls).toEqual([
      "opencode/deepseek-v4-pro",
      "openai/gpt-5.5",
      "opencode/big-pickle",
    ])
    expect(result.output).toContain('state="error"')
    expect(result.metadata.attemptedModels).toEqual(calls)
  })

  test("times out a hanging model and notifies background parents", async () => {
    const { aborted, calls, context, notified, task } = await setup(
      ["hang", response("Recovered")],
      5,
      true,
    )

    const started = await task.execute({ ...args, background: true }, context)
    const notification = await notified

    expect(started.output).toContain('state="running"')
    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(aborted).toEqual(["child-1"])
    expect(notification.body.parts[0].text).toContain('state="completed"')
  })
})
