import { AssistantPanel } from './assistant-panel'
import { AssistantProvider } from './assistant-provider'

/**
 * Lazy entry point (loaded on first open, keeps the conversation afterwards): the AI SDK is ~100 KB gzip
 * and no page needs it until the assistant is used.
 */
export default function AssistantRoot({
  userKey,
  pendingQuestion,
  open,
  onClose,
}: {
  userKey: string
  pendingQuestion: { id: number; text: string } | null
  open: boolean
  onClose: () => void
}) {
  return (
    <AssistantProvider userKey={userKey} pendingQuestion={pendingQuestion}>
      {open && <AssistantPanel onClose={onClose} />}
    </AssistantProvider>
  )
}
