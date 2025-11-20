import { useCallback, useEffect, useRef, useState } from 'react'

import type { CapabilityPayload, CapabilitySnapshot } from '@/types/capabilities'

type UseCapabilitiesResult = {
  capabilities: CapabilitySnapshot | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCapabilities(): UseCapabilitiesResult {
  const [capabilities, setCapabilities] = useState<CapabilitySnapshot | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/capabilities', {
        method: 'GET',
        signal: abortController.signal,
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const body = (await response.json()) as {
        capabilities?: CapabilityPayload
      }

      if (!body?.capabilities) {
        throw new Error('Claude capabilities payload was empty')
      }

      setCapabilities({ ...body.capabilities, fetchedAt: Date.now() })
    } catch (error) {
      if (abortController.signal.aborted) {
        return
      }

      setError(error instanceof Error ? error.message : 'Failed to load capabilities')
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [refresh])

  return { capabilities, isLoading, error, refresh }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = `Failed to load capabilities (status ${response.status})`

  try {
    const data = (await response.json()) as { error?: string; details?: string }
    return data?.details || data?.error || fallback
  } catch {
    return fallback
  }
}
