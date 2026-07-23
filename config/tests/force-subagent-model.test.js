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
    deleteError,
    existingSessions = [],
    existingStatuses = {},
    failMessageReadAt,
    parentActive = false,
    parentEvents = ["idle"],
    parentNotifications = [],
    parentStatusError,
  } = options
  const calls = []
  const aborted = []
  const deleted = []
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
      list: async () => ({ data: existingSessions }),
      get: async () => ({ data: { id: "parent-session", permission: [] } }),
      create: async () => ({ data: { id: `child-${++child}` } }),
      abort: async (request) => {
        aborted.push(request.path.id)
        return { data: true }
      },
      delete: async (request) => {
        deleted.push(request.path.id)
        if (deleteError) return { error: deleteError }
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
            ...existingStatuses,
            ...(parentActive ? { "parent-session": { type: "busy" } } : {}),
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
    deleted,
    emitEvent,
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
  test("deletes existing idle subagent sessions", async () => {
    const { deleted } = await setup([], {
      existingSessions: [
        {
          id: "old-child",
          directory: "/tmp/project",
          parentID: "parent-session",
          title: "Inspect code (opencode/model @explore subagent)",
          time: { updated: 0 },
        },
        {
          id: "old-fork",
          directory: "/tmp/project",
          title: "Inspect code (opencode/model @explore subagent) (fork #2)",
          time: { updated: 0 },
        },
        {
          id: "active-child",
          directory: "/tmp/project",
          parentID: "parent-session",
          title: "Inspect code (opencode/model @explore subagent)",
          time: { updated: 0 },
        },
        {
          id: "archived-child",
          directory: "/tmp/project",
          parentID: "parent-session",
          title: "Inspect code (opencode/model @explore subagent)",
          time: { archived: 1, updated: 0 },
        },
        {
          id: "recent-child",
          directory: "/tmp/project",
          parentID: "parent-session",
          title: "Inspect code (opencode/model @explore subagent)",
          time: { updated: Date.now() },
        },
        {
          id: "manual-root",
          directory: "/tmp/project",
          title: "Notes (foo @bar subagent)",
          time: { updated: 0 },
        },
        { id: "regular", directory: "/tmp/project", title: "Regular chat", time: { updated: 0 } },
      ],
      existingStatuses: { "active-child": { type: "busy" } },
    })

    expect(deleted).toEqual(["old-child", "old-fork", "archived-child"])
  })

  test("falls back from the configured model to OpenAI", async () => {
    const { calls, context, deleted, task } = await setup([
      sdkError({ name: "ProviderError" }),
      response("Recovered"),
    ])

    const result = await task.execute(args, context)

    expect(calls).toEqual(["opencode/deepseek-v4-pro", "openai/gpt-5.5"])
    expect(result.metadata.model).toBe("openai/gpt-5.5")
    expect(result.metadata.sessionId).toBeUndefined()
    expect(result.output).toContain('state="completed"')
    expect(result.output).not.toContain('id="')
    expect(deleted).toEqual(["child-1", "child-2"])
  })

  test("does not discard results when deletion fails", async () => {
    const { context, task } = await setup([response("Recovered")], {
      deleteError: { name: "DeleteError" },
    })

    const result = await task.execute(args, context)

    expect(result.output).toContain("Recovered")
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

  test("cancels foreground children without starting fallbacks", async () => {
    const { aborted, calls, context, controller, deleted, task } = await setup(["hang"], {
      attemptTimeoutMs: 1_000,
    })
    const running = task.execute(args, context)
    while (calls.length === 0) await Promise.resolve()

    controller.abort(new Error("cancelled by user"))

    await expect(running).rejects.toThrow("cancelled by user")
    expect(aborted).toEqual(["child-1"])
    expect(deleted).toEqual(["child-1"])
    expect(calls).toEqual(["opencode/deepseek-v4-pro"])
  })

  test("aborts a child when cancelled before its prompt starts", async () => {
    const { aborted, calls, context, controller, deleted, task } = await setup([])
    controller.abort(new Error("cancelled by user"))

    await expect(task.execute(args, context)).rejects.toThrow("cancelled by user")
    expect(aborted).toEqual(["child-1"])
    expect(deleted).toEqual(["child-1"])
    expect(calls).toEqual([])
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
    const { aborted, calls, context, deleted, notified, parentEventsSent, task } = await setup(
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
    expect(deleted).toEqual(["child-1", "child-2"])
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
