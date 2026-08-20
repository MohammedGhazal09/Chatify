import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  History,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserRoundX,
} from 'lucide-react';
import type { PrivacyOperationsPayload, PrivacyOperationsStatus } from '../../api/privacyOperationsApi';
import { usePrivacyOperations } from '../../hooks/usePrivacyOperations';
import { useLocale, type TranslationKey } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { useChatTheme } from '../chat/hooks/useChatTheme';
import '../chat/chat.css';

const statusLabels: Record<PrivacyOperationsStatus, TranslationKey> = {
  ok: 'admin.privacyOperations.status.ok',
  attention: 'admin.privacyOperations.status.attention',
  blocked: 'admin.privacyOperations.status.blocked',
};

const runStatusLabels = {
  completed: 'admin.privacyOperations.runStatus.completed',
  failed: 'admin.privacyOperations.runStatus.failed',
} satisfies Record<string, TranslationKey>;

const formatInterval = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '--';
  }

  return `${Math.round(value / 60000)}m`;
};

const AdminPrivacyOperations = () => {
  const user = useAuthStore((state) => state.user);
  const { direction, t, formatDateTime } = useLocale();
  const chatTheme = useChatTheme(user?._id);
  const privacyOperationsQuery = usePrivacyOperations();
  const privacyOperations = privacyOperationsQuery.data;
  const generatedAt = privacyOperations?.generatedAt
    ? t('admin.privacyOperations.generatedAt', {
        values: {
          date: formatDateTime(privacyOperations.generatedAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        },
      })
    : t('date.unknown');

  const summaryMetrics = useMemo(() => {
    if (!privacyOperations) {
      return [];
    }

    return [
      { label: t('admin.privacyOperations.pendingDeletionRequests'), value: privacyOperations.deletionRequests.pending, icon: <UserRoundX aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.privacyOperations.dueDeletionRequests'), value: privacyOperations.deletionRequests.due, icon: <TimerReset aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.privacyOperations.completedDeletionRequests'), value: privacyOperations.deletionRequests.completed, icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.privacyOperations.cleanupBacklog'), value: privacyOperations.retention.cleanupBacklog, icon: <Trash2 aria-hidden="true" className="h-4 w-4" /> },
    ];
  }, [privacyOperations, t]);

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
                <h1 className="text-lg font-semibold">{t('admin.privacyOperations.accessRequiredTitle')}</h1>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">{t('admin.privacyOperations.accessRequiredDescription')}</p>
              </div>
            </div>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('admin.privacyOperations.backToChat')}
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
                aria-label={t('admin.privacyOperations.backToAdmin')}
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]">{t('admin.privacyOperations.eyebrow')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold">{t('admin.privacyOperations.title')}</h1>
                  {privacyOperations && <StatusBadge status={privacyOperations.status}>{t(statusLabels[privacyOperations.status])}</StatusBadge>}
                </div>
                <p className="mt-1 text-xs text-[var(--chat-text-muted)]">{generatedAt}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => privacyOperationsQuery.refetch()}
              disabled={privacyOperationsQuery.isFetching}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-sm font-semibold text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${privacyOperationsQuery.isFetching ? 'motion-safe:animate-spin' : ''}`} />
              {t('admin.privacyOperations.refresh')}
            </button>
          </div>
        </header>

        {privacyOperationsQuery.isLoading ? (
          <StateMessage icon={<Activity aria-hidden="true" className="h-5 w-5" />} title={t('admin.privacyOperations.loading')} />
        ) : privacyOperationsQuery.isError ? (
          <StateMessage
            icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
            title={t('admin.privacyOperations.unavailable')}
            role="alert"
          />
        ) : privacyOperations ? (
          <PrivacyOperationsContent
            formatDateTime={formatDateTime}
            privacyOperations={privacyOperations}
            summaryMetrics={summaryMetrics}
            t={t}
          />
        ) : null}
      </main>
    </div>
  );
};

const PrivacyOperationsContent = ({
  formatDateTime,
  privacyOperations,
  summaryMetrics,
  t,
}: {
  formatDateTime: ReturnType<typeof useLocale>['formatDateTime'];
  privacyOperations: PrivacyOperationsPayload;
  summaryMetrics: Array<{ label: string; value: string | number; icon: ReactNode }>;
  t: ReturnType<typeof useLocale>['t'];
}) => {
  const lastRun = privacyOperations.worker.lastRun;
  const lastRunAt = lastRun?.completedAt
    ? formatDateTime(lastRun.completedAt, { dateStyle: 'medium', timeStyle: 'short' })
    : t('admin.privacyOperations.noRuns');

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6">
      <section aria-label={t('admin.privacyOperations.summaryLabel')}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {summaryMetrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} icon={metric.icon} />
          ))}
        </div>
      </section>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)]" aria-label={t('admin.privacyOperations.queueLabel')}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--chat-border)] px-4 py-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <UserRoundX aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
              {t('admin.privacyOperations.queueLabel')}
            </h2>
            <StatusBadge status={privacyOperations.status}>{t(statusLabels[privacyOperations.status])}</StatusBadge>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <MiniMetric label={t('admin.privacyOperations.pendingDeletionRequests')} value={privacyOperations.deletionRequests.pending} />
            <MiniMetric label={t('admin.privacyOperations.dueDeletionRequests')} value={privacyOperations.deletionRequests.due} />
            <MiniMetric label={t('admin.privacyOperations.completedDeletionRequests')} value={privacyOperations.deletionRequests.completed} />
          </div>
          <div className="border-t border-[var(--chat-border)] px-4 py-3 text-sm text-[var(--chat-text-muted)]">
            {t('admin.privacyOperations.queueBoundary')}
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <DiagnosticsPanel
            icon={<Server aria-hidden="true" className="h-4 w-4" />}
            title={t('admin.privacyOperations.workerLabel')}
            status={privacyOperations.status}
            statusLabel={t(statusLabels[privacyOperations.status])}
          >
            <DetailLine label={t('admin.privacyOperations.workerEnabled')} value={privacyOperations.worker.enabled ? t('admin.privacyOperations.yes') : t('admin.privacyOperations.no')} />
            <DetailLine label={t('admin.privacyOperations.interval')} value={formatInterval(privacyOperations.worker.intervalMs)} />
            <DetailLine label={t('admin.privacyOperations.batchSize')} value={privacyOperations.worker.batchSize} />
            <DetailLine label={t('admin.privacyOperations.lastRun')} value={lastRunAt} />
            <DetailLine label={t('admin.privacyOperations.lastRunStatus')} value={lastRun ? t(runStatusLabels[lastRun.status]) : t('admin.privacyOperations.noRuns')} />
          </DiagnosticsPanel>
        </aside>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
        <DiagnosticsPanel
          icon={<Database aria-hidden="true" className="h-4 w-4" />}
          title={t('admin.privacyOperations.retentionLabel')}
          status={privacyOperations.retention.cleanupBacklog > 0 ? 'attention' : 'ok'}
          statusLabel={privacyOperations.retention.cleanupBacklog > 0 ? t('admin.privacyOperations.status.attention') : t('admin.privacyOperations.status.ok')}
        >
          <DetailLine label={t('admin.privacyOperations.expiredExportAudits')} value={privacyOperations.retention.expiredExportAudits} />
          <DetailLine label={t('admin.privacyOperations.expiredPasswordResets')} value={privacyOperations.retention.expiredPasswordResets} />
          <DetailLine label={t('admin.privacyOperations.expiredSessions')} value={privacyOperations.retention.expiredSessions} />
          <DetailLine label={t('admin.privacyOperations.terminalNotificationOutbox')} value={privacyOperations.retention.terminalNotificationOutbox} />
          <DetailLine label={t('admin.privacyOperations.outboxRetention')} value={`${privacyOperations.retention.notificationOutboxRetentionDays}d`} />
        </DiagnosticsPanel>

        <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
            {t('admin.privacyOperations.boundaryLabel')}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--chat-text-muted)]">{t('admin.privacyOperations.boundaryCopy')}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[var(--chat-text-soft)]">
            <History aria-hidden="true" className="h-4 w-4" />
            {t('admin.privacyOperations.evidenceCopy')}
          </div>
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
      <p className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</p>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--chat-radius-sm)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
        {icon}
      </span>
    </div>
    <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--chat-text)]">{value}</p>
  </div>
);

const MiniMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2">
    <dt className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</dt>
    <dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd>
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
  status: PrivacyOperationsStatus;
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

const StatusBadge = ({ status, children }: { status: PrivacyOperationsStatus; children: ReactNode }) => {
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

export default AdminPrivacyOperations;
