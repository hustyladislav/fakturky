// Kept apart from the provider so the app shell can clear it on sign-out without loading the AI SDK.
export const STORAGE_PREFIX = 'assistant.messages.v1'
export const THREAD_PREFIX = 'assistant.thread.v1'

/** Per signed-in user, so a shared browser never restores someone else's conversation. */
export const storageKey = (userKey: string) => `${STORAGE_PREFIX}:${userKey}`
export const threadKey = (userKey: string) => `${THREAD_PREFIX}:${userKey}`

/** Called on sign-out: removes every stored conversation of this browser tab. */
export function clearAssistantStorage() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(STORAGE_PREFIX) || key.startsWith(THREAD_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {
    // storage unavailable
  }
}
