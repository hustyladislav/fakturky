import { createContext, useContext } from 'react'

export interface ShellState {
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Opens the assistant panel and sends the question typed into ⌘K. */
  askAssistant: (question: string) => void
}

export const ShellContext = createContext<ShellState | null>(null)

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used inside AppShell')
  return ctx
}
