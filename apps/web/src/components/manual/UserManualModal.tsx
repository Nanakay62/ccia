/**
 * In-App User Manual Modal Component.
 * Provides interactive search, chapter navigation, and one-click downloads
 * for both Microsoft Word (.doc) and PDF formats.
 */

import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Download,
  Printer,
  Search,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { USER_MANUAL_CHAPTERS, downloadUserManualWord, printUserManualPdf } from '../../utils/exports/userManualGenerator.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { useDemo } from '../../context/DemoContext.js';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  const { isDemoMode } = useDemo();
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    USER_MANUAL_CHAPTERS[0]?.id || 'overview'
  );
  const [searchQuery, setSearchQuery] = useState('');

  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  const filteredChapters = USER_MANUAL_CHAPTERS.filter((ch) => {
    const q = searchQuery.toLowerCase();
    return (
      ch.title.toLowerCase().includes(q) ||
      ch.contentHtml.toLowerCase().includes(q)
    );
  });

  const activeChapter =
    USER_MANUAL_CHAPTERS.find((ch) => ch.id === selectedChapterId) || USER_MANUAL_CHAPTERS[0]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Platform User Manual"
    >
      <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--radius)] bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-[17px] font-bold text-[var(--text-primary)] leading-tight">
                  CCIA Church Accounting Platform — User Manual
                </h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/30">
                  v2.0 GHS/USD
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                Accra Central Grace Chapel • Standard Operating Procedures & User Guide
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Word Export Button */}
            <button
              onClick={() => downloadUserManualWord(isDemoMode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] hover:bg-[var(--surface-border-subtle)] border border-[var(--surface-border)] text-[12px] font-semibold text-[var(--text-primary)] transition"
              title="Download editable Microsoft Word document (.doc)"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Word Guide (.doc)</span>
            </button>

            {/* PDF Export Button */}
            <button
              onClick={() => printUserManualPdf(isDemoMode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-semibold transition"
              title="Print or save as formatted PDF document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF Guide</span>
            </button>

            {/* Direct Link to Pre-compiled PDF */}
            <a
              href="/docs/CCIA_Church_Accounting_Platform_User_Manual.pdf"
              download="CCIA_Church_Accounting_Platform_User_Manual.pdf"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] hover:bg-[var(--surface-border-subtle)] border border-[var(--surface-border)] text-[12px] font-semibold text-[var(--text-primary)] transition"
              title="Download compiled standalone PDF document"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Download PDF</span>
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
              aria-label="Close user manual"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (2 Columns: Sidebar & Content) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Chapter Navigation Sidebar */}
          <div className="w-full md:w-72 border-r border-[var(--surface-border)] bg-[var(--surface-ground)]/40 flex flex-col shrink-0">
            {/* Search Input */}
            <div className="p-3 border-b border-[var(--surface-border)]">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search manual topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[12px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                />
              </div>
            </div>

            {/* Chapter List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredChapters.map((ch) => {
                const isSelected = ch.id === activeChapter.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChapterId(ch.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius)] text-left text-[13px] transition ${
                      isSelected
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border-l-2 border-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {ch.number}.
                      </span>
                      <span className="truncate">{ch.title}</span>
                    </div>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chapter Content View */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 select-text bg-[var(--surface-panel)]">
            <div className="pb-3 border-b border-[var(--surface-border)]">
              <div className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-wider">
                Chapter {activeChapter.number}
              </div>
              <h1 className="font-serif text-[22px] font-bold text-[var(--text-primary)] mt-1">
                {activeChapter.title}
              </h1>
            </div>

            <div
              className="prose prose-slate max-w-none text-[14px] leading-relaxed text-[var(--text-secondary)]"
              dangerouslySetInnerHTML={{ __html: activeChapter.contentHtml }}
            />

            {/* Chapter Bottom Navigation */}
            <div className="pt-6 border-t border-[var(--surface-border)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
              <span>Chapter {activeChapter.number} of {USER_MANUAL_CHAPTERS.length}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadUserManualWord(isDemoMode)}
                  className="hover:text-[var(--accent)] underline font-medium"
                >
                  Save as Word (.doc)
                </button>
                <span>•</span>
                <button
                  onClick={() => printUserManualPdf(isDemoMode)}
                  className="hover:text-[var(--accent)] underline font-medium"
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
