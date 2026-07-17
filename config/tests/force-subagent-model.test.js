import { describe, expect, test } from "bun:test"
import forceSubagentModel from "../plugins/force-subagent-model.js"

function response(text, error) {
  return { error, text }
}

function sdkError(error) {
  return { sdkError: error }
}

function messageError(error) {
  return { messageError: error }
}

const retry = Symbol("retry")

async function setup(responses, options = {}) {
  const {
    attemptTimeoutMs = 50,
    failMessageReadAt,
    parentActive = false,
    parentEvents = ["idle"],
    parentNotifications = [],
    parentStatusError,
    resumedSession = {},
    resumedStatus,
  } = options
  const calls = []
  const aborted = []
  const forks = []
  const parentEventsSent = []
  let parentNotificationCalls = 0
  let messageReads = 0
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
      get: async (request) => ({
        data:
          request.path.id === "parent-session"
            ? { id: "parent-session", permission: [] }
            : {
                id: request.path.id,
                parentID: "parent-session",
                directory: "/tmp/project",
                agent: "explore",
                ...resumedSession,
              },
      }),
      create: async () => ({ data: { id: `child-${++child}` } }),
      fork: async (request) => {
        const sessionID = `child-${++child}`
        forks.push(request.path.id)
        messages.set(sessionID, [...(messages.get(request.path.id) ?? [])])
        return { data: { id: sessionID } }
      },
      abort: async (request) => {
        aborted.push(request.path.id)
        return { data: true }
      },
      messages: async (request) => {
        messageReads++
        if (messageReads === failMessageReadAt) {
          return { error: { name: "MessageReadError" } }
        }
        return { data: messages.get(request.path.id) ?? [] }
      },
      status: async () => {
        if (parentActive) {
          queueMicrotask(() => {
            void (async () => {
              for (const type of parentEvents) {
                const event =
                  type === "retry"
                    ? {
                        type: "session.status",
                        properties: {
                          sessionID: "parent-session",
                          status: { type: "retry", attempt: 1 },
                        },
                      }
                    : { type: `session.${type}`, properties: { sessionID: "parent-session" } }
                await emitEvent(event)
                parentEventsSent.push(type)
              }
            })()
          })
        }
        if (parentStatusError) return { error: parentStatusError }
        return {
          data: {
            ...(parentActive ? { "parent-session": { type: "busy" } } : {}),
            ...(resumedStatus ? { "existing-session": { type: resumedStatus } } : {}),
          },
        }
      },
      promptAsync: async (request) => {
        if (request.path.id === "parent-session") {
          parentNotificationCalls++
          const next = parentNotifications.shift()
          if (next?.error) return { error: next.error }
          notify(request)
          return { data: undefined }
        }

        const sessionID = request.path.id
        calls.push(`${request.body.model.providerID}/${request.body.model.modelID}`)
        const next = responses.shift()
        if (next === "hang") return { data: undefined }
        if (next === retry) {
          await emitEvent({
            type: "session.status",
            properties: { sessionID, status: { type: "retry", attempt: 1 } },
          })
          return { data: undefined }
        }
        if (next instanceof Error) throw next
        if (next.sdkError) return { error: next.sdkError }
        if (next.messageError) {
          await emitEvent({
            type: "message.updated",
            properties: {
              info: {
                id: `message-${sessionID}`,
                sessionID,
                role: "assistant",
                providerID: request.body.model.providerID,
                modelID: request.body.model.modelID,
                error: next.messageError,
              },
            },
          })
          return { data: undefined }
        }
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
              agent: "explore",
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
  const controller = new AbortController()
  const context = {
    abort: controller.signal,
    agent: "build",
    ask: async () => {},
    directory: "/tmp/project",
    sessionID: "parent-session",
  }

  return {
    aborted,
    calls,
    context,
    controller,
    emitEvent,
    forks,
    messages,
    notified,
    get parentNotificationCalls() {
      return parentNotificationCalls
    },
    parentEventsSent,
    task: plugin.tool.task,
  }
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

  test("uses an exact model chain without implicit fallbacks", async () => {
    const { calls, context, task } = await setup([
      response(undefined, { name: "ProviderError" }),
      response(undefined, { name: "ProviderError" }),
    ])

    const result = await task.execute(
      {
        ...args,
        models: ["openai/gpt-5.6-luna", "openai/gpt-5.5"],
      },
      context,
    )

    expect(calls).toEqual(["openai/gpt-5.6-luna", "openai/gpt-5.5"])
    expect(result.output).toContain('state="error"')
  })

  test("preserves repeated models in an exact chain", async () => {
    const { calls, context, task } = await setup([
      response(undefined, { name: "ProviderError" }),
      response("Recovered"),
    ])

    const result = await task.execute(
      {
        ...args,
        models: ["openai/gpt-5.5", "openai/gpt-5.5"],
      },
      context,
    )

    expect(calls).toEqual(["openai/gpt-5.5", "openai/gpt-5.5"])
    expect(result.metadata.model).toBe("openai/gpt-5.5")
  })

  test("falls back immediately on assistant message errors", async () => {
    const { aborted, calls, context, task } = await setup([
      messageError({ name: "ApiError" }),
      response("Recovered"),
    ])

    const result = await task.execute(args, context)

    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(aborted).toEqual([])
    expect(result.metadata.model).toBe("openai/gpt-5.5")
  })

  test("falls back immediately when the provider enters retry state", async () => {
    const { aborted, calls, context, task } = await setup([retry, response("Recovered")])

    const result = await task.execute(args, context)

    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(aborted).toEqual(["child-1"])
    expect(result.metadata.model).toBe("openai/gpt-5.5")
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

    expect(result.metadata.sessionId).toBe("child-1")
    expect(result.output).toContain("Current result")
    expect(result.output).not.toContain("Stale result")
  })

  test("rejects concurrent runs on the same resumed session", async () => {
    const { calls, context, task } = await setup(["hang", response("Recovered")], {
      attemptTimeoutMs: 100,
    })
    const first = task.execute({ ...args, task_id: "existing-session" }, context)
    while (calls.length === 0) await Promise.resolve()

    const second = task.execute({ ...args, task_id: "existing-session" }, context)

    await expect(second).rejects.toThrow("already running")
    await first
  })

  test("rejects a resumed session that is still active", async () => {
    const { context, task } = await setup([], { resumedStatus: "retry" })

    await expect(
      task.execute({ ...args, task_id: "existing-session" }, context),
    ).rejects.toThrow("is not idle")
  })

  test("rejects a resumed session from another parent", async () => {
    const { context, task } = await setup([], {
      resumedSession: { parentID: "another-parent" },
    })

    await expect(
      task.execute({ ...args, task_id: "existing-session" }, context),
    ).rejects.toThrow("does not match this task")
  })

  test("rejects a resumed session for another agent", async () => {
    const { context, task } = await setup([], {
      resumedSession: { agent: "general" },
    })

    await expect(
      task.execute({ ...args, task_id: "existing-session" }, context),
    ).rejects.toThrow("does not match this task")
  })

  test("forks the original context for every resumed fallback", async () => {
    const { calls, context, forks, messages, task } = await setup([
      response(undefined, { name: "ProviderError" }),
      response("Recovered"),
    ])
    messages.set("existing-session", [
      {
        info: {
          id: "old-message",
          role: "assistant",
          time: { created: 1 },
          finish: "stop",
        },
        parts: [{ type: "text", text: "Prior context" }],
      },
    ])

    const result = await task.execute({ ...args, task_id: "existing-session" }, context)

    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(forks).toEqual(["existing-session", "existing-session"])
    expect(messages.get("child-2")[0].parts[0].text).toBe("Prior context")
    expect(result.output).toContain("Recovered")
  })

  test("ignores source-session events after forking a resume", async () => {
    const { calls, context, emitEvent, messages, task } = await setup(["hang"], {
      attemptTimeoutMs: 100,
    })
    const running = task.execute({ ...args, task_id: "existing-session" }, context)
    while (calls.length === 0) await Promise.resolve()

    await emitEvent({ type: "session.error", properties: { sessionID: "existing-session" } })
    expect(calls).toEqual(["opencode/deepseek-v4-pro"])

    messages.set("child-1", [
      {
        info: {
          id: "current-message",
          role: "assistant",
          agent: "explore",
          time: { created: Date.now() },
          finish: "stop",
        },
        parts: [{ type: "text", text: "Current result" }],
      },
    ])
    await emitEvent({ type: "session.idle", properties: { sessionID: "child-1" } })

    const result = await running
    expect(result.output).toContain("Current result")
  })

  test("cancels foreground children without starting fallbacks", async () => {
    const { aborted, calls, context, controller, task } = await setup(["hang"], {
      attemptTimeoutMs: 1_000,
    })
    const running = task.execute(args, context)
    while (calls.length === 0) await Promise.resolve()

    controller.abort(new Error("cancelled by user"))

    await expect(running).rejects.toThrow("cancelled by user")
    expect(aborted).toEqual(["child-1"])
    expect(calls).toEqual(["opencode/deepseek-v4-pro"])
  })

  test("aborts a child when cancelled before its prompt starts", async () => {
    const { aborted, calls, context, controller, task } = await setup([])
    controller.abort(new Error("cancelled by user"))

    await expect(task.execute(args, context)).rejects.toThrow("cancelled by user")
    expect(aborted).toEqual(["child-1"])
    expect(calls).toEqual([])
  })

  test("releases a resumed session cancelled before its prompt starts", async () => {
    const { aborted, context, controller, forks, task } = await setup([response("Recovered")])
    controller.abort(new Error("cancelled by user"))

    await expect(task.execute({ ...args, task_id: "existing-session" }, context)).rejects.toThrow(
      "cancelled by user",
    )
    context.abort = new AbortController().signal
    const result = await task.execute({ ...args, task_id: "existing-session" }, context)

    expect(aborted).toEqual(["child-1"])
    expect(forks).toEqual(["existing-session", "existing-session"])
    expect(result.output).toContain("Recovered")
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
    const { aborted, calls, context, notified, parentEventsSent, task } = await setup(
      ["hang", response("Recovered")],
      {
        attemptTimeoutMs: 5,
        parentActive: true,
        parentEvents: ["retry", "idle"],
      },
    )

    const started = await task.execute({ ...args, background: true }, context)
    const notification = await notified

    expect(started.output).toContain('state="running"')
    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(aborted).toEqual(["child-1"])
    expect(parentEventsSent).toEqual(["retry", "idle"])
    expect(notification.body.parts[0].text).toContain('state="completed"')
  })

  test("notifies after parent readiness timeout", async () => {
    const { context, notified, parentEventsSent, task } = await setup(
      [response("Recovered")],
      { attemptTimeoutMs: 5, parentActive: true, parentEvents: ["retry"] },
    )

    await task.execute({ ...args, background: true }, context)
    const notification = await notified

    expect(parentEventsSent).toEqual(["retry"])
    expect(notification.body.parts[0].text).toContain('state="completed"')
  })

  test("waits for parent readiness when its status cannot be read", async () => {
    const { context, notified, parentEventsSent, task } = await setup([response("Recovered")], {
      parentActive: true,
      parentStatusError: { name: "StatusError" },
    })

    await task.execute({ ...args, background: true }, context)
    const notification = await notified

    expect(parentEventsSent).toEqual(["idle"])
    expect(notification.body.parts[0].text).toContain('state="completed"')
  })

  test("retries rejected background notifications", async () => {
    const setupResult = await setup([response("Recovered")], {
      parentNotifications: [{ error: { name: "Busy" } }],
    })

    await setupResult.task.execute({ ...args, background: true }, setupResult.context)
    const notification = await setupResult.notified

    expect(setupResult.parentNotificationCalls).toBe(2)
    expect(notification.body.parts[0].text).toContain('state="completed"')
  })

  test("reports message-read failures instead of consuming fallbacks", async () => {
    const { aborted, calls, context, task } = await setup([response("Recovered")], {
      failMessageReadAt: 2,
    })

    await expect(task.execute(args, context)).rejects.toThrow("Unable to read subagent output")
    expect(calls).toEqual(["opencode/deepseek-v4-pro"])
    expect(aborted).toEqual(["child-1"])
  })

  test("aborts children when their initial message read fails", async () => {
    const { aborted, calls, context, task } = await setup([], { failMessageReadAt: 1 })

    await expect(task.execute(args, context)).rejects.toThrow("Unable to inspect subagent session")
    expect(calls).toEqual([])
    expect(aborted).toEqual(["child-1"])
  })
})
