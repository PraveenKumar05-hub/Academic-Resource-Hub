import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeModeContext = createContext()

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('theme-mode') || 'light')

  useEffect(() => {
    localStorage.setItem('theme-mode', mode)
  }, [mode])

  function toggleMode() {
    setMode((current) => (current === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider')
  }
  return context
}