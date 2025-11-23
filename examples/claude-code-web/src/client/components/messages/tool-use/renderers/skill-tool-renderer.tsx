import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { Loader2 } from 'lucide-react';

export class SkillToolRenderer extends BaseToolRenderer {
    constructor() {
        super('Skill');
    }

    header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
        const command = isNonEmptyRecord(input)
            ? String(input.command ?? '')
            : '';

        return (
            <>
                <span className="font-semibold">Skill</span>
                {command && (
                    <>
                        <span className="mx-2 text-muted-foreground">/</span>
                        <span className="font-medium text-foreground">{command}</span>
                    </>
                )}
            </>
        );
    }

    // Override body to provide custom rendering for all states
    body(
        _context: ClaudeMessageContext,
        input: ToolInput,
        result: ToolResultContentBlock | undefined,
    ): ReactNode {
        console.log('[SkillToolRenderer] body called', { input, hasResult: !!result });
        const command = isNonEmptyRecord(input) ? String(input.command ?? '') : '';

        // No result = running state
        if (!result) {
            console.log('[SkillToolRenderer] Rendering RUNNING state');
            return this.renderRunningState(command);
        }

        // Has result = completed state
        console.log('[SkillToolRenderer] Rendering COMPLETED state');
        return this.renderCompletedState(result);
    }

    private renderRunningState(command: string): ReactNode {
        return (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">
                    Running skill{command ? `: ${command}` : '...'}
                </span>
            </div>
        );
    }

    private renderCompletedState(result: ToolResultContentBlock): ReactNode {
        const rawOutput = typeof result.content === 'string'
            ? result.content
            : Array.isArray(result.content)
                ? result.content.map(c => c.text).join('')
                : '';

        if (!rawOutput) {
            return null; // Don't show anything for empty output
        }

        // Check if this is just a simple launch message
        const isSimpleLaunch = /^(Launching|Running)\s+skill:/i.test(rawOutput.trim());

        if (isSimpleLaunch) {
            // For simple launch messages, show a minimal indicator
            return (
                <div className="text-xs text-muted-foreground italic">
                    Skill activated
                </div>
            );
        }

        // Parse XML-like tags for more complex outputs
        const messageMatch = rawOutput.match(/<command-message>(.*?)<\/command-message>/s);
        const message = messageMatch ? messageMatch[1].trim() : '';

        // Remove the tags from the remaining content to show as details
        const details = rawOutput
            .replace(/<command-message>.*?<\/command-message>/gs, '')
            .replace(/<command-name>.*?<\/command-name>/gs, '')
            .trim();

        return (
            <div className="flex flex-col gap-3">
                {/* Main message - prominently displayed */}
                {message && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
                        {message}
                    </div>
                )}

                {/* Technical details - collapsed by default */}
                {details && (
                    <details className="group text-xs">
                        <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground transition-colors">
                            <span className="inline-flex items-center gap-1.5">
                                <svg
                                    className="h-3 w-3 transition-transform group-open:rotate-90"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                Technical details
                            </span>
                        </summary>
                        <div className="mt-2 rounded border border-border/50 bg-muted/50 p-2">
                            <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground max-h-60 overflow-y-auto">
                                {details}
                            </pre>
                        </div>
                    </details>
                )}

                {/* If no message was parsed and not a simple launch, show raw output as fallback */}
                {!message && rawOutput && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                        <pre className="whitespace-pre-wrap text-xs font-mono max-h-60 overflow-y-auto">
                            {rawOutput}
                        </pre>
                    </div>
                )}
            </div>
        );
    }
}
