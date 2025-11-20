import { useEffect, useRef } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import { SessionSummary } from './types'
import { formatRelativeTime } from './utils'

type SessionListProps = {
  sessions: SessionSummary[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  isLoading: boolean
  errorMessage: string | null
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelect,
  onDelete,
  isLoading,
  errorMessage,
}: SessionListProps) {
  const selectedEntryRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (selectedEntryRef.current) {
      selectedEntryRef.current.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }
  }, [selectedSessionId, sessions])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (errorMessage) {
    return <div className="px-2 text-xs text-destructive">{errorMessage}</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="px-2 text-xs text-muted-foreground">
        No sessions yet.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => {
        const isSelected = session.id === selectedSessionId
        return (
          <div
            key={session.id}
            role="button"
            tabIndex={0}
            ref={isSelected ? selectedEntryRef : null}
            onClick={() => onSelect(session.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(session.id)
              }
            }}
            className={cn(
              'w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected ? 'bg-muted' : 'bg-transparent',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 flex-none rounded-full bg-red-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {session.prompt || 'Untitled session'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(session.lastMessageAt)}
                </p>
              </div>
              {onDelete ? (
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  title="Delete session"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(session.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
