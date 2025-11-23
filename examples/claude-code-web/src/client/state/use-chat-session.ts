import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { addNewSDKMessage, convertSDKMessages } from '@claude-agent-kit/messages'
import type {
  OutcomingMessage,
  SessionSDKOptions,
} from '@claude-agent-kit/server'

import type { PermissionMode, ThinkingLevel } from '@/types/session'

import { sortMessages } from '@/lib/chat-message-utils'

import {
  chatMessagesAtom,
  chatProjectIdAtom,
  chatSessionIdAtom,
  chatSessionInfoAtom,
  createDefaultChatSessionInfo,
} from './chat-atoms'

export function useChatSessionState() {
  const messages = useAtomValue(chatMessagesAtom)
  const sessionId = useAtomValue(chatSessionIdAtom)
  const projectId = useAtomValue(chatProjectIdAtom)
  const sessionInfo = useAtomValue(chatSessionInfoAtom)

  return { messages, sessionId, projectId, sessionInfo }
}

export function useOutcomingMessageHandler() {
  const setSessionId = useSetAtom(chatSessionIdAtom)
  const setMessages = useSetAtom(chatMessagesAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)

  return useCallback(
    (payload: OutcomingMessage) => {
      // More informative logging
      if (payload.type === 'session_state_changed') {
        const stateInfo: Record<string, unknown> = { sessionId: payload.sessionId }
        if (payload.sessionState.isBusy !== undefined) stateInfo.isBusy = payload.sessionState.isBusy
        if (payload.sessionState.isLoading !== undefined) stateInfo.isLoading = payload.sessionState.isLoading
        if (payload.sessionState.options) stateInfo.optionsUpdated = true
        console.log('[useOutcomingMessageHandler] session_state_changed', stateInfo)
      } else if (payload.type === 'messages_updated') {
        console.log('[useOutcomingMessageHandler] messages_updated', {
          sessionId: payload.sessionId,
          messageCount: payload.messages?.length,
        })
      } else {
        console.log('[useOutcomingMessageHandler]', payload.type, {
          sessionId: payload.sessionId,
        })
      }

      setSessionId(payload.sessionId ?? null)

      if (payload.type === 'message_added') {
        setMessages((previous) => {
          const updated = sortMessages(addNewSDKMessage(previous, payload.message))
          console.log('[useOutcomingMessageHandler] message_added, messages:', previous.length, '->', updated.length)
          return updated
        })
        return
      }

      if (payload.type === 'messages_updated') {
        const updated = sortMessages(convertSDKMessages(payload.messages))
        console.log('[useOutcomingMessageHandler] messages_updated applied, new count:', updated.length)
        setMessages(updated)
        return
      }

      if (payload.type === 'session_state_changed') {
        setSessionInfo((previous) => ({
          ...previous,
          ...payload.sessionState,
        }))
      }
    },
    [setMessages, setSessionId, setSessionInfo],
  )
}

export type ChatSessionSelectionPayload = {
  sessionId: string | null
  projectId: string | null
}

export function useSelectChatSession() {
  const setSessionId = useSetAtom(chatSessionIdAtom)
  const setProjectId = useSetAtom(chatProjectIdAtom)
  const setMessages = useSetAtom(chatMessagesAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)
  const currentSessionId = useAtomValue(chatSessionIdAtom)

  return useCallback(
    ({ sessionId, projectId }: ChatSessionSelectionPayload) => {
      // Clear messages when session changes, EXCEPT when transitioning null -> sessionId
      // (which happens when backend assigns an ID to current session)
      const isSessionChange =
        currentSessionId !== sessionId &&  // Session actually changed
        currentSessionId !== null          // Not transitioning from null (backend ID assignment)

      console.log('[useSelectChatSession]', {
        from: currentSessionId,
        to: sessionId,
        projectId,
        willClearMessages: isSessionChange,
      })

      setSessionId(sessionId)
      setProjectId(projectId)

      // Only clear when switching between two concrete sessionIds
      if (isSessionChange) {
        console.log('[useSelectChatSession] CLEARING MESSAGES')
        setMessages([])
        setSessionInfo(createDefaultChatSessionInfo())
      }
    },
    [
      currentSessionId,
      setMessages,
      setProjectId,
      setSessionId,
      setSessionInfo,
    ],
  )
}

type SetSDKOptionsFn = (
  options: Partial<SessionSDKOptions>,
  sessionId?: string | null,
) => void

export function useChatSessionOptions(setSDKOptions: SetSDKOptionsFn) {
  const sessionId = useAtomValue(chatSessionIdAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)

  const setSessionOptions = useCallback(
    (options: Partial<SessionSDKOptions>, broadcast = true) => {
      setSessionInfo((previous) => ({
        ...previous,
        options: {
          ...previous.options,
          ...options,
        },
      }))

      if (broadcast) {
        setSDKOptions(options, sessionId ?? null)
      }
    },
    [sessionId, setSDKOptions, setSessionInfo],
  )

  const setPermissionMode = useCallback(
    (mode: PermissionMode, broadcast = true) => {
      setSessionOptions({ permissionMode: mode }, broadcast)
    },
    [setSessionOptions],
  )

  const setThinkingLevel = useCallback(
    (level: ThinkingLevel, broadcast = true) => {
      setSessionOptions({ thinkingLevel: level }, broadcast)
    },
    [setSessionOptions],
  )

  return {
    setSessionOptions,
    setPermissionMode,
    setThinkingLevel,
  }
}
