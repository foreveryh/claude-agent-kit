type ChatHeaderProps = {
  sessionId: string | null
  isConnected: boolean
  connectionMessage: string | null
  onUploadSkillClick?: () => void
  isUploadingSkill?: boolean
  skillUploadMessage?: string | null
}

export function ChatHeader({
  sessionId,
  isConnected,
  connectionMessage,
  onUploadSkillClick,
  isUploadingSkill,
  skillUploadMessage,
}: ChatHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Claude Code Chat
          </h1>
          <p className="text-sm text-slate-500">
            {sessionId ? `Session • ${sessionId}` : 'New session'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
              isConnected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-current" />
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onUploadSkillClick}
            disabled={!onUploadSkillClick || isUploadingSkill}
          >
            {isUploadingSkill ? 'Uploading skill…' : 'Upload skill'}
          </button>
          {connectionMessage ? (
            <span className="text-xs text-slate-400">{connectionMessage}</span>
          ) : null}
        </div>
      </div>
      {skillUploadMessage ? (
        <div className="mx-auto flex w-full max-w-6xl justify-end px-6 pb-3 text-xs text-slate-500">
          {skillUploadMessage}
        </div>
      ) : null}
    </header>
  )
}
