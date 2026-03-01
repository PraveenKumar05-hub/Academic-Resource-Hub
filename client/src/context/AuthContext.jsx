import React, { createContext, useState, useEffect, useContext } from 'react'
import api from '../api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [])

  async function fetchProfile() {
    try {
      const res = await api.get('/auth/profile')
      setUser(res.data.user)
      setError(null)
    } catch (err) {
      localStorage.removeItem('token')
      setUser(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    try {
      setLoading(true)
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
      setError(null)
      return res.data
    } catch (err) {
      setError(err.response?.data?.message || err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    localStorage.removeItem('token')
    setUser(null)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
