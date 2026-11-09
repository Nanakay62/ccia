export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number | null;
  disabled?: boolean;
  ariaLabel?: string;
}

export type UnderlineTabItem<T extends string = string> = TabItem<T>;

export interface UnderlineTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  ariaLabel?: string;
  tabRole?: 'tab' | 'button';
}

export function UnderlineTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  ariaLabel,
  tabRole = 'tab',
}: UnderlineTabsProps<T>) {
  return (
    <div
      className={`flex items-center border-b border-[var(--surface-border)] gap-6 text-[14px] select-none ${className}`}
      role={tabRole === 'tab' ? 'tablist' : undefined}
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role={tabRole}
            aria-selected={tabRole === 'tab' ? isActive : undefined}
            aria-label={tab.ariaLabel}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`pb-2.5 font-medium transition flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-t-[2px] disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span className="text-[12px] font-normal tabular-nums text-[var(--text-muted)]">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
