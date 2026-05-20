import { createContext, useContext, useState, useCallback, createElement } from 'react'

const NavigationGuardContext = createContext(null)

export function NavigationGuardProvider({ children }) {
  const [isDirty,       setIsDirty]       = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const markDirty = useCallback(() => setIsDirty(true), [])

  const markClean = useCallback(() => {
    setIsDirty(false)
    setPendingAction(null)
  }, [])

  const guardAction = useCallback((action) => {
    if (!isDirty) { action(); return }
    setPendingAction(() => action)
  }, [isDirty])

  const confirmPending = useCallback(() => {
    if (pendingAction) pendingAction()
    setIsDirty(false)
    setPendingAction(null)
  }, [pendingAction])

  const cancelPending = useCallback(() => setPendingAction(null), [])

  const value = { isDirty, markDirty, markClean, pendingAction, guardAction, confirmPending, cancelPending }

  return createElement(NavigationGuardContext.Provider, { value }, children)
}

export const useNavigationGuard = () => useContext(NavigationGuardContext)
