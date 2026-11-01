import React from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button.js';

export interface AttentionItem {
  id: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  severity?: 'amber' | 'red' | 'neutral';
}

interface NeedsAttentionSectionProps {
  items: AttentionItem[];
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({ items }) => {
  if (!items || items.length === 0) {
    return null; // Per spec: "Needs attention (only when there is something)"
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--status-amber)]/30 bg-[var(--status-amber)]/5 overflow-hidden">
      <div className="px-4 py-2 bg-[var(--status-amber)]/10 border-b border-[var(--status-amber)]/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <AlertCircle className="w-3.5 h-3.5 text-[var(--status-amber)]" />
          <span>Needs Attention ({items.length})</span>
        </div>
        <span className="text-[11px] text-[var(--text-secondary)]">Action required before close</span>
      </div>

      <div className="divide-y divide-[var(--status-amber)]/15">
        {items.map((item) => (
          <div
            key={item.id}
            className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-[var(--status-amber)]/10 transition"
          >
            <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.severity === 'red' ? 'bg-[var(--status-red)]' : 'bg-[var(--status-amber)]'
                }`}
              />
              <span className="text-[13.5px] leading-snug">{item.message}</span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={item.onAction}
              className="text-xs shrink-0 font-medium py-1 px-3 h-auto"
            >
              <span>{item.actionLabel}</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
