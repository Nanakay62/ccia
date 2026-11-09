import React, { useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from '../../context/RouterContext.js';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  onBack?: () => void;
  backLabel?: string;
  currentId?: string;
  listKey?: string;
  onNavigatePrev?: (prevId: string) => void;
  onNavigateNext?: (nextId: string) => void;
  actions?: React.ReactNode;
}

export const PageBreadcrumb: React.FC<PageBreadcrumbProps> = ({
  items,
  onBack,
  backLabel = 'Back',
  currentId,
  listKey,
  onNavigatePrev,
  onNavigateNext,
  actions,
}) => {
  const { goBack, getPrevNext, navigate } = useRouter();

  const prevNext = currentId ? getPrevNext(currentId, listKey) : null;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  };

  const handlePrev = () => {
    if (prevNext?.prevId) {
      if (onNavigatePrev) {
        onNavigatePrev(prevNext.prevId);
      } else if (listKey) {
        navigate(`#/${listKey}/${encodeURIComponent(prevNext.prevId)}`);
      }
    }
  };

  const handleNext = () => {
    if (prevNext?.nextId) {
      if (onNavigateNext) {
        onNavigateNext(prevNext.nextId);
      } else if (listKey) {
        navigate(`#/${listKey}/${encodeURIComponent(prevNext.nextId)}`);
      }
    }
  };

  // Keyboard navigation for Prev/Next record
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '[' || (e.altKey && e.key === 'ArrowLeft')) {
        if (prevNext?.prevId) {
          e.preventDefault();
          handlePrev();
        }
      } else if (e.key === ']' || (e.altKey && e.key === 'ArrowRight')) {
        if (prevNext?.nextId) {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevNext]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--surface-border)] mb-5">
      {/* Left: Back button & Breadcrumb trail */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius)] text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border border-[var(--surface-border)] transition shrink-0"
          title="Back to list (restores scroll position and filters)"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] min-w-0 truncate">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[var(--text-muted)] select-none">/</span>}
                {isLast ? (
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <a
                    href={item.href}
                    className="hover:text-[var(--text-primary)] hover:underline truncate"
                  >
                    {item.label}
                  </a>
                ) : item.onClick ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="hover:text-[var(--text-primary)] hover:underline truncate"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Prev / Next record arrows & custom actions */}
      <div className="flex items-center gap-2 shrink-0">
        {prevNext && prevNext.totalCount > 1 && (
          <div className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] mr-2 bg-[var(--surface-subtle)] px-2 py-1 rounded-[var(--radius)] border border-[var(--surface-border)]">
            <span className="font-sans tabular-nums text-[11px] text-[var(--text-muted)] mr-1">
              {prevNext.currentIndex > 0 ? `${prevNext.currentIndex} of ${prevNext.totalCount}` : `${prevNext.totalCount} records`}
            </span>
            <button
              type="button"
              onClick={handlePrev}
              disabled={!prevNext.prevId}
              className="p-1 rounded hover:bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Previous record ([)"
              aria-label="Previous record"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!prevNext.nextId}
              className="p-1 rounded hover:bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Next record (])"
              aria-label="Next record"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {actions}
      </div>
    </div>
  );
};
