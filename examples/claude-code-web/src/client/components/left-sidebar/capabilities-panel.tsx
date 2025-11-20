import { Children, useMemo, useState } from 'react'
import { ChevronDown, RefreshCw, Terminal } from 'lucide-react'

import type { CapabilitySnapshot, LocalSkill } from '@/types/capabilities'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

type CapabilitiesPanelProps = {
  capabilities?: CapabilitySnapshot | null
  isLoading?: boolean
  errorMessage?: string | null
  onRefresh?: () => void | Promise<void>
}

export function CapabilitiesPanel({
  capabilities,
  isLoading,
  errorMessage,
  onRefresh,
}: CapabilitiesPanelProps) {
  const tools = capabilities?.tools ?? []
  const slashCommands = capabilities?.slashCommands ?? []
  const skills = capabilities?.skills ?? []
  const mcpServers = capabilities?.mcpServers ?? []
  const localSkills = capabilities?.localSkills ?? []
  const hasData =
    tools.length +
    slashCommands.length +
    skills.length +
    mcpServers.length +
    localSkills.length > 0

  return (
    <section className="rounded-lg border border-slate-200 bg-white/80 p-3 text-xs text-slate-600 shadow-sm">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Terminal className="h-4 w-4 text-slate-400" />
            Claude Capabilities
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {capabilities
              ? buildSummaryLine(capabilities) || 'Ready to inspect available tools.'
              : 'Inspect Claude once to discover available tools.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Refresh Claude capabilities"
        >
          <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {errorMessage ? (
        <p className="mb-2 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {hasData ? (
        <div className="space-y-2">
          <CapabilitySection title={`Tools (${tools.length})`} defaultOpen>
            {tools.map((tool) => (
              <CapabilityBadge key={tool} label={tool} />
            ))}
          </CapabilitySection>

          <CapabilitySection title={`MCP Servers (${mcpServers.length})`} defaultOpen>
            {mcpServers.map((server) => (
              <div
                key={server.name}
                className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"
              >
                <span className="font-medium text-slate-700">{server.name}</span>
                <StatusBadge status={server.status} />
              </div>
            ))}
          </CapabilitySection>

          <CapabilitySection title={`Local Skills (${localSkills.length})`} defaultOpen>
            {localSkills.map((skill) => (
              <SkillCard key={skill.slug} skill={skill} />
            ))}
          </CapabilitySection>

          <CapabilitySection title={`Slash Commands (${slashCommands.length})`} defaultOpen>
            {slashCommands.map((command) => (
              <CapabilityBadge key={command} label={`/${command}`} />
            ))}
          </CapabilitySection>

          <CapabilitySection title={`Skills (${skills.length || slashCommands.length})`}>
            {skills.length > 0
              ? skills.map((skill) => (
                  <CapabilityBadge key={skill} label={skill} variant="ghost" />
                ))
              : slashCommands.map((command) => (
                  <CapabilityBadge key={`skill-${command}`} label={command} variant="ghost" />
                ))}
          </CapabilitySection>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          Run any prompt or press refresh to capture Claude&apos;s available tools, MCP
          servers, and slash commands.
        </p>
      )}
    </section>
  )
}

type CapabilitySectionProps = {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function CapabilitySection({ title, children, defaultOpen }: CapabilitySectionProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen))

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-slate-700"
        >
          <span>{title}</span>
          <ChevronDown
            className={cn('h-3 w-3 transition-transform duration-150', open ? 'rotate-0' : '-rotate-90')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 text-[11px]">
        {Children.count(children) === 0 ? (
          <p className="text-slate-400">Nothing available.</p>
        ) : (
          children
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

type CapabilityBadgeProps = {
  label: string
  variant?: 'solid' | 'ghost'
}

function CapabilityBadge({ label, variant = 'solid' }: CapabilityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        variant === 'solid'
          ? 'bg-slate-900/90 text-white'
          : 'bg-slate-100 text-slate-600',
      )}
    >
      {label}
    </span>
  )
}

type StatusBadgeProps = {
  status: string
}

function StatusBadge({ status }: StatusBadgeProps) {
  const { label, tone } = useMemo(() => classifyStatus(status), [status])

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tone.bg, tone.text)}>
      <span className={cn('h-2 w-2 rounded-full', tone.dot)} />
      {label}
    </span>
  )
}

function classifyStatus(status: string) {
  const label = status || 'unknown'
  const normalized = label.toLowerCase()
  if (normalized.includes('ready') || normalized.includes('connected')) {
    return {
      label,
      tone: {
        bg: 'bg-emerald-100/80',
        text: 'text-emerald-800',
        dot: 'bg-emerald-500',
      },
    }
  }

  if (normalized.includes('error') || normalized.includes('fail')) {
    return {
      label,
      tone: {
        bg: 'bg-red-100/80',
        text: 'text-red-700',
        dot: 'bg-red-500',
      },
    }
  }

  return {
    label,
    tone: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      dot: 'bg-slate-400',
    },
  }
}

function buildSummaryLine(capabilities: CapabilitySnapshot): string {
  const parts: string[] = []

  if (capabilities.model) {
    parts.push(`Model ${capabilities.model}`)
  }

  if (capabilities.cwd) {
    parts.push(capabilities.cwd)
  }

  if (capabilities.permissionMode) {
    parts.push(`Mode: ${capabilities.permissionMode}`)
  }

  return parts.join(' • ')
}

type SkillCardProps = {
  skill: LocalSkill
}

function SkillCard({ skill }: SkillCardProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white/70 px-2 py-1">
      <p className="text-[12px] font-semibold text-slate-800">{skill.name}</p>
      {skill.description ? (
        <p className="text-[11px] text-slate-500">{skill.description}</p>
      ) : (
        <p className="text-[11px] text-slate-400">No description</p>
      )}
      <p className="text-[10px] text-slate-400">{skill.path}</p>
    </div>
  )
}
