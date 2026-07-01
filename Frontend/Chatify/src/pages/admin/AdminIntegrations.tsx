import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Unplug,
} from 'lucide-react';
import type { IntegrationDiagnosticsPayload, IntegrationDiagnosticsStatus } from '../../api/integrationDiagnosticsApi';
import { useIntegrationDiagnostics } from '../../hooks/useIntegrationDiagnostics';
import { useLocale, type TranslationKey } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { useChatTheme } from '../chat/hooks/useChatTheme';
import '../chat/chat.css';

const statusLabels: Record<IntegrationDiagnosticsStatus, TranslationKey> = {
  ok: 'admin.integrations.status.ok',
  attention: 'admin.integrations.status.attention',
  blocked: 'admin.integrations.status.blocked',
};

const AdminIntegrations = () => {
  const user = useAuthStore((state) => state.user);
  const { direction, t, formatDateTime } = useLocale();
  const chatTheme = useChatTheme(user?._id);
  const diagnosticsQuery = useIntegrationDiagnostics();
  const diagnostics = diagnosticsQuery.data;
  const generatedAt = diagnostics?.generatedAt
    ? t('admin.integrations.generatedAt', {
        values: {
          date: formatDateTime(diagnostics.generatedAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        },
      })
    : t('date.unknown');

  const summaryMetrics = useMemo(() => {
    if (!diagnostics) {
      return [];
    }

    return [
      { label: t('admin.integrations.registeredApps'), value: diagnostics.apps.total, icon: <Puzzle aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.integrations.activeInstalls'), value: diagnostics.installations.active, icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.integrations.revokedInstalls'), value: diagnostics.installations.revoked, icon: <Unplug aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.integrations.runtimeReads'), value: diagnostics.runtime.manifestReads, icon: <Activity aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.integrations.deniedRuntime'), value: diagnostics.runtime.deniedAccess, icon: <AlertTriangle aria-hidden="true" className="h-4 w-4" /> },
    ];
  }, [diagnostics, t]);

  if (user?.role !== 'admin') {
    return (
      <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
        <main className="grid min-h-[100dvh] place-items-center bg-[var(--chat-bg)] px-4 text-[var(--chat-text)]" dir={direction}>
          <section className="w-full max-w-md rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-5 shadow-[var(--chat-shadow)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-danger)]">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold">{t('admin.integrations.accessRequiredTitle')}</h1>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">{t('admin.integrations.accessRequiredDescription')}</p>
              </div>
            </div>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('admin.integrations.backToChat')}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
      <main className="flex min-h-[100dvh] flex-col bg-[var(--chat-bg)] text-[var(--chat-text)]" dir={direction}>
        <header className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/admin"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label={t('admin.integrations.backToAdmin')}
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]">{t('admin.integrations.eyebrow')}</p>
                <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-balance text-xl font-semibold">{t('admin.integrations.title')}</h1>
                  {diagnostics && <StatusBadge status={diagnostics.status}>{t(statusLabels[diagnostics.status])}</StatusBadge>}
                </div>
                <p className="mt-1 text-pretty text-xs text-[var(--chat-text-muted)]">{generatedAt}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => diagnosticsQuery.refetch()}
              disabled={diagnosticsQuery.isFetching}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-sm font-semibold text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${diagnosticsQuery.isFetching ? 'motion-safe:animate-spin' : ''}`} />
              {t('admin.integrations.refresh')}
            </button>
          </div>
        </header>

        {diagnosticsQuery.isLoading ? (
          <StateMessage icon={<Activity aria-hidden="true" className="h-5 w-5" />} title={t('admin.integrations.loading')} />
        ) : diagnosticsQuery.isError ? (
          <StateMessage
            icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
            title={t('admin.integrations.unavailable')}
            role="alert"
          />
        ) : diagnostics ? (
          <IntegrationDiagnosticsContent
            diagnostics={diagnostics}
            formatDateTime={formatDateTime}
            summaryMetrics={summaryMetrics}
            t={t}
          />
        ) : null}
      </main>
    </div>
  );
};

const IntegrationDiagnosticsContent = ({
  diagnostics,
  formatDateTime,
  summaryMetrics,
  t,
}: {
  diagnostics: IntegrationDiagnosticsPayload;
  formatDateTime: ReturnType<typeof useLocale>['formatDateTime'];
  summaryMetrics: Array<{ label: string; value: string | number; icon: ReactNode }>;
  t: ReturnType<typeof useLocale>['t'];
}) => {
  const scopeEntries = Object.entries(diagnostics.scopes);
  const latestAuditAt = diagnostics.latestAuditAt
    ? formatDateTime(diagnostics.latestAuditAt, { dateStyle: 'medium', timeStyle: 'short' })
    : t('admin.integrations.noAudit');

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6">
      <section aria-label={t('admin.integrations.summaryLabel')}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {summaryMetrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} icon={metric.icon} />
          ))}
        </div>
      </section>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)]" aria-label={t('admin.integrations.permissionLabel')}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--chat-border)] px-4 py-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
              {t('admin.integrations.permissionLabel')}
            </h2>
            <StatusBadge status={diagnostics.status}>{t(statusLabels[diagnostics.status])}</StatusBadge>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <MiniMetric label={t('admin.integrations.activeApps')} value={diagnostics.apps.active} />
            <MiniMetric label={t('admin.integrations.activeInstalls')} value={diagnostics.installations.active} />
            <MiniMetric label={t('admin.integrations.revokedInstalls')} value={diagnostics.installations.revoked} />
            <MiniMetric label={t('admin.integrations.latestAudit')} value={latestAuditAt} />
          </div>
          <div className="border-t border-[var(--chat-border)] px-4 py-3 text-pretty text-sm text-[var(--chat-text-muted)]">
            {t('admin.integrations.permissionBoundary')}
          </div>
        </section>

        <DiagnosticsPanel
          icon={<KeyRound aria-hidden="true" className="h-4 w-4" />}
          title={t('admin.integrations.runtimeLabel')}
          status={diagnostics.status}
          statusLabel={t(statusLabels[diagnostics.status])}
        >
          <DetailLine label={t('admin.integrations.runtimeReads')} value={diagnostics.runtime.manifestReads} />
          <DetailLine label={t('admin.integrations.deniedRuntime')} value={diagnostics.runtime.deniedAccess} />
          <DetailLine label={t('admin.integrations.registeredApps')} value={diagnostics.apps.total} />
          <DetailLine label={t('admin.integrations.revokedInstalls')} value={diagnostics.installations.revoked} />
        </DiagnosticsPanel>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
        <DiagnosticsPanel
          icon={<Puzzle aria-hidden="true" className="h-4 w-4" />}
          title={t('admin.integrations.scopeLabel')}
          status={scopeEntries.length > 0 ? 'ok' : 'attention'}
          statusLabel={scopeEntries.length > 0 ? t('admin.integrations.status.ok') : t('admin.integrations.noScopes')}
        >
          {scopeEntries.length > 0 ? (
            scopeEntries.map(([scope, count]) => (
              <DetailLine key={scope} label={scope} value={count} />
            ))
          ) : (
            <p className="rounded-[var(--chat-radius-sm)] bg-[var(--chat-panel-subtle)] px-3 py-2 text-sm text-[var(--chat-text-muted)]">{t('admin.integrations.noScopes')}</p>
          )}
        </DiagnosticsPanel>

        <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
            {t('admin.integrations.boundaryLabel')}
          </h2>
          <p className="mt-3 text-pretty text-sm leading-6 text-[var(--chat-text-muted)]">{t('admin.integrations.boundaryCopy')}</p>
          <p className="mt-4 text-xs font-semibold text-[var(--chat-text-soft)]">{t('admin.integrations.evidenceCopy')}</p>
        </section>
      </section>
    </div>
  );
};

const StateMessage = ({
  icon,
  title,
  role = 'status',
}: {
  icon: ReactNode;
  title: string;
  role?: 'status' | 'alert';
}) => (
  <div className="grid min-h-[420px] flex-1 place-items-center px-4 text-center text-sm text-[var(--chat-text-muted)]" role={role}>
    <div>
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-text-soft)]">
        {icon}
      </span>
      <p className="mt-3 font-semibold text-[var(--chat-text)]">{title}</p>
    </div>
  </div>
);

const Metric = ({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) => (
  <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-xs font-semibold text-[var(--chat-text-muted)]">{label}</p>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--chat-radius-sm)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
        {icon}
      </span>
    </div>
    <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--chat-text)]">{value}</p>
  </div>
);

const MiniMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2">
    <p className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</p>
    <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
  </div>
);

const DiagnosticsPanel = ({
  icon,
  title,
  status,
  statusLabel,
  children,
}: {
  icon: ReactNode;
  title: string;
  status: IntegrationDiagnosticsStatus;
  statusLabel: string;
  children: ReactNode;
}) => (
  <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <span className="text-[var(--chat-accent)]">{icon}</span>
        {title}
      </h2>
      <StatusBadge status={status}>{statusLabel}</StatusBadge>
    </div>
    <div className="mt-3 grid gap-2">
      {children}
    </div>
  </section>
);

const DetailLine = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex min-h-8 items-center justify-between gap-3 rounded-[var(--chat-radius-sm)] bg-[var(--chat-panel-subtle)] px-3 py-1.5 text-sm">
    <span className="min-w-0 text-[var(--chat-text-muted)]">{label}</span>
    <span className="shrink-0 font-semibold tabular-nums">{value}</span>
  </div>
);

const StatusBadge = ({ status, children }: { status: IntegrationDiagnosticsStatus; children: ReactNode }) => {
  const toneClass = status === 'blocked'
    ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_12%,var(--chat-panel))] text-[var(--chat-danger)]'
    : status === 'attention'
      ? 'border-[color-mix(in_srgb,var(--chat-warning)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-warning)_12%,var(--chat-panel))] text-[var(--chat-warning)]'
      : 'border-[color-mix(in_srgb,var(--chat-success)_42%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-success)_10%,var(--chat-panel))] text-[var(--chat-success)]';

  return (
    <span className={`inline-flex min-h-6 items-center rounded-[var(--chat-radius-sm)] border px-2 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
};

export default AdminIntegrations;
