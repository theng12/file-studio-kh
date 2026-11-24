import type { ComponentType } from 'react';
import type { RouteId } from '../App';
import {
  IconActions,
  IconAdvanced,
  IconDashboard,
  IconFiles,
  IconHeart,
  IconHistory,
  IconLogo,
  IconSettings,
} from './icons';
import { useI18n } from '../i18n';

interface SidebarProps {
  activeRoute: RouteId;
  appVersion: string;
  onNavigate: (route: RouteId) => void;
  onOpenWhatsNew: () => void;
}

const mainNav = [
  { id: 'dashboard', labelKey: 'dashboard', icon: IconDashboard },
  { id: 'files', labelKey: 'files', icon: IconFiles },
  { id: 'actions', labelKey: 'actions', icon: IconActions },
  { id: 'history', labelKey: 'history', icon: IconHistory },
  { id: 'advanced', labelKey: 'advanced', icon: IconAdvanced },
] satisfies Array<{ id: RouteId; labelKey: Parameters<ReturnType<typeof useI18n>['t']>[0]; icon: ComponentType<{ className?: string }> }>;

function SidebarButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
        active
          ? 'bg-neutral-200 font-semibold text-neutral-950 dark:bg-neutral-800 dark:text-white'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50'
      }`}
      onClick={onClick}
    >
      <Icon className={`size-[18px] ${active ? 'text-accent' : 'text-neutral-400'}`} />
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({ activeRoute, appVersion, onNavigate, onOpenWhatsNew }: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="flex h-screen min-h-0 w-[220px] shrink-0 flex-col border-r border-line bg-white px-3 py-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-7 flex shrink-0 items-center gap-3 px-2">
        <div className="grid size-10 place-items-center overflow-hidden rounded-lg shadow-sm shadow-neutral-200 dark:shadow-none">
          <IconLogo className="size-10" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{t('fileStudioKh')}</div>
          <div className="text-xs text-neutral-500">{t('localFileWorkbench')}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-auto">
        <nav>
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{t('workspace')}</div>
          <div className="space-y-1">
            {mainNav.map((item) => (
              <SidebarButton
                key={item.id}
                active={activeRoute === item.id}
                icon={item.icon}
                label={t(item.labelKey)}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        </nav>
      </div>

      <div className="shrink-0 border-t border-line pt-3 dark:border-neutral-800">
        <div className="space-y-1">
          <SidebarButton
            active={activeRoute === 'settings'}
            icon={IconSettings}
            label={t('settings')}
            onClick={() => onNavigate('settings')}
          />
          <SidebarButton
            active={activeRoute === 'support'}
            icon={IconHeart}
            label={t('supportThisApp')}
            onClick={() => onNavigate('support')}
          />
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          onClick={onOpenWhatsNew}
          title={`${t('fileStudioKh')} v${appVersion} — ${t('whatsNew')}`}
          aria-label={`${t('fileStudioKh')} version ${appVersion}. Open What's New.`}
        >
          <span className="truncate">{t('fileStudioKh')}</span>
          <span className="shrink-0 text-neutral-500 dark:text-neutral-400">v{appVersion}</span>
        </button>
      </div>
    </aside>
  );
}
