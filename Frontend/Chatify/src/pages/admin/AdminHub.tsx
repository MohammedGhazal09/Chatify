import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Database,
  ExternalLink,
  Inbox,
  Puzzle,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { DeliveryHealthStatus } from '../../api/deliveryHealthApi';
import type { IntegrationDiagnosticsStatus } from '../../api/integrationDiagnosticsApi';
import type { PrivacyOperationsStatus } from '../../api/privacyOperationsApi';
import { useDeliveryHealth } from '../../hooks/useDeliveryHealth';
import { useIntegrationDiagnostics } from '../../hooks/useIntegrationDiagnostics';
import { useModerationOpsSummary } from '../../hooks/useModerationReports';
import { usePrivacyOperations } from '../../hooks/usePrivacyOperations';
import { useLocale, type TranslationKey } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { useChatTheme } from '../chat/hooks/useChatTheme';
import '../chat/chat.css';

const deliveryStatusLabels: Record<DeliveryHealthStatus, TranslationKey> = {
  ok: 'admin.deliveryHealth.status.ok',
  degraded: 'admin.deliveryHealth.status.degraded',
  blocked: 'admin.deliveryHealth.status.blocked',
};

const privacyStatusLabels: Record<PrivacyOperationsStatus, TranslationKey> = {
  ok: 'admin.privacyOperations.status.ok',
  attention: 'admin.privacyOperations.status.attention',
  blocked: 'admin.privacyOperations.status.blocked',
};

const integrationStatusLabels: Record<IntegrationDiagnosticsStatus, TranslationKey> = {
  ok: 'admin.integrations.status.ok',
  attention: 'admin.integrations.status.attention',
  blocked: 'admin.integrations.status.blocked',
};

const formatPercent = (value: number | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

const AdminHub = () => {
  const user = useAuthStore((state) => state.user);
  const { direction, t } = useLocale();
  const chatTheme = useChatTheme(user?._id);
  const moderationSummaryQuery = useModerationOpsSummary();
  const deliveryHealthQuery = useDeliveryHealth('24h');
  const privacyOperationsQuery = usePrivacyOperations();
  const integrationDiagnosticsQuery = useIntegrationDiagnostics();
  const moderationSummary = moderationSummaryQuery.data;
  const deliveryHealth = deliveryHealthQuery.data;
  const privacyOperations = privacyOperationsQuery.data;
  const integrationDiagnostics = integrationDiagnosticsQuery.data;
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
        <main className="grid min-h-[100dvh] place-items-center bg-[var(--chat-bg)] px-4 text-[var(--chat-text)]" dir={direction}>
          <section className="w-full max-w-md rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-5 shadow-[var(--chat-shadow)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-danger)]">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold">{t('admin.hub.accessRequiredTitle')}</h1>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">{t('admin.hub.accessRequiredDescription')}</p>
              </div>
            </div>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('admin.hub.backToChat')}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const moderationStatus = moderationSummaryQuery.isLoading
    ? t('admin.hub.loading')
    : moderationSummaryQuery.isError
      ? t('admin.hub.unavailable')
      : t('admin.hub.needsReview', { values: { count: moderationSummary?.reportsByStatus.open ?? 0 } });

  const deliveryStatus = deliveryHealthQuery.isLoading
    ? t('admin.hub.loading')
    : deliveryHealthQuery.isError
      ? t('admin.hub.unavailable')
      : deliveryHealth
        ? t(deliveryStatusLabels[deliveryHealth.summary.status])
        : t('admin.hub.unavailable');
  const privacyStatus = privacyOperationsQuery.isLoading
    ? t('admin.hub.loading')
    : privacyOperationsQuery.isError
      ? t('admin.hub.unavailable')
      : privacyOperations
        ? t(privacyStatusLabels[privacyOperations.status])
        : t('admin.hub.unavailable');
  const lastPrivacyRun = privacyOperations?.worker.lastRun?.completedAt
    ? t('admin.hub.lastRunKnown')
    : t('admin.hub.lastRunMissing');
  const integrationStatus = integrationDiagnosticsQuery.isLoading
    ? t('admin.hub.loading')
    : integrationDiagnosticsQuery.isError
      ? t('admin.hub.unavailable')
      : integrationDiagnostics
        ? t(integrationStatusLabels[integrationDiagnostics.status])
        : t('admin.hub.unavailable');

  return (
    <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
      <main className="min-h-[100dvh] bg-[var(--chat-bg)] text-[var(--chat-text)]" dir={direction}>
        <header className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label={t('admin.hub.backToChat')}
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]">{t('admin.hub.eyebrow')}</p>
                <h1 className="truncate text-xl font-semibold">{t('admin.hub.title')}</h1>
                <p className="mt-1 max-w-3xl text-sm text-[var(--chat-text-muted)]">{t('admin.hub.description')}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('admin.hub.snapshotLabel')}>
            <SnapshotMetric icon={<Inbox aria-hidden="true" className="h-4 w-4" />} label={t('admin.hub.openReports')} value={moderationSummary?.reportsByStatus.open ?? '--'} />
            <SnapshotMetric icon={<Scale aria-hidden="true" className="h-4 w-4" />} label={t('admin.hub.openAppeals')} value={moderationSummary?.appealsByStatus.open ?? '--'} />
            <SnapshotMetric icon={<Activity aria-hidden="true" className="h-4 w-4" />} label={t('admin.hub.deliveryStatus')} value={deliveryStatus} />
            <SnapshotMetric icon={<Database aria-hidden="true" className="h-4 w-4" />} label={t('admin.hub.privacyStatus')} value={privacyStatus} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4" aria-label={t('admin.hub.toolsLabel')}>
            <AdminToolCard
              icon={<Scale aria-hidden="true" className="h-5 w-5" />}
              title={t('admin.hub.moderationTitle')}
              description={t('admin.hub.moderationDescription')}
              status={moderationStatus}
              to="/admin/moderation"
              actionLabel={t('admin.hub.openModeration')}
              metrics={[
                { label: t('admin.hub.openReports'), value: moderationSummary?.reportsByStatus.open ?? '--' },
                { label: t('admin.hub.openAppeals'), value: moderationSummary?.appealsByStatus.open ?? '--' },
                { label: t('admin.hub.unassigned'), value: moderationSummary?.unassignedOpen ?? '--' },
                { label: t('admin.hub.assignedToMe'), value: moderationSummary?.assignedToMeOpen ?? '--' },
              ]}
            />
            <AdminToolCard
              icon={<BarChart3 aria-hidden="true" className="h-5 w-5" />}
              title={t('admin.hub.deliveryTitle')}
              description={t('admin.hub.deliveryDescription')}
              status={deliveryStatus}
              to="/admin/delivery-health"
              actionLabel={t('admin.hub.openDeliveryHealth')}
              metrics={[
                { label: t('admin.deliveryHealth.totalMessages'), value: deliveryHealth?.summary.totalMessages ?? '--' },
                { label: t('admin.deliveryHealth.deliveryRate'), value: formatPercent(deliveryHealth?.summary.deliveryRate) },
                { label: t('admin.deliveryHealth.staleSent'), value: deliveryHealth?.summary.staleSent ?? '--' },
                { label: t('admin.deliveryHealth.staleDelivered'), value: deliveryHealth?.summary.staleDelivered ?? '--' },
              ]}
            />
            <AdminToolCard
              icon={<Database aria-hidden="true" className="h-5 w-5" />}
              title={t('admin.hub.privacyTitle')}
              description={t('admin.hub.privacyDescription')}
              status={privacyStatus}
              to="/admin/privacy-operations"
              actionLabel={t('admin.hub.openPrivacyOperations')}
              metrics={[
                { label: t('admin.privacyOperations.pendingDeletionRequests'), value: privacyOperations?.deletionRequests.pending ?? '--' },
                { label: t('admin.privacyOperations.dueDeletionRequests'), value: privacyOperations?.deletionRequests.due ?? '--' },
                { label: t('admin.privacyOperations.cleanupBacklog'), value: privacyOperations?.retention.cleanupBacklog ?? '--' },
                { label: t('admin.hub.lastPrivacyRun'), value: lastPrivacyRun },
              ]}
            />
            <AdminToolCard
              icon={<Puzzle aria-hidden="true" className="h-5 w-5" />}
              title={t('admin.hub.integrationsTitle')}
              description={t('admin.hub.integrationsDescription')}
              status={integrationStatus}
              to="/admin/integrations"
              actionLabel={t('admin.hub.openIntegrations')}
              metrics={[
                { label: t('admin.integrations.registeredApps'), value: integrationDiagnostics?.apps.total ?? '--' },
                { label: t('admin.integrations.activeInstalls'), value: integrationDiagnostics?.installations.active ?? '--' },
                { label: t('admin.integrations.runtimeReads'), value: integrationDiagnostics?.runtime.manifestReads ?? '--' },
                { label: t('admin.integrations.deniedRuntime'), value: integrationDiagnostics?.runtime.deniedAccess ?? '--' },
              ]}
            />
          </section>

          <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 text-sm text-[var(--chat-text-muted)]" aria-label={t('admin.hub.boundaryLabel')}>
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
              <p>{t('admin.hub.boundaryCopy')}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const SnapshotMetric = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) => (
  <div className="flex min-h-20 items-center justify-between gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3">
    <div className="min-w-0">
      <p className="truncate text-sm text-[var(--chat-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--chat-text)]">{value}</p>
    </div>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
      {icon}
    </span>
  </div>
);

const AdminToolCard = ({
  icon,
  title,
  description,
  status,
  to,
  actionLabel,
  metrics,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  status: string;
  to: string;
  actionLabel: string;
  metrics: Array<{ label: string; value: ReactNode }>;
}) => (
  <article className="flex min-h-[320px] flex-col rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--chat-text-muted)]">{description}</p>
        </div>
      </div>
      <StatusPill>{status}</StatusPill>
    </div>

    <dl className="mt-5 divide-y divide-[var(--chat-border)] border-y border-[var(--chat-border)]">
      {metrics.map((metric) => (
        <div key={metric.label} className="flex min-h-11 items-center justify-between gap-4 px-3 py-2">
          <dt className="min-w-0 truncate text-sm text-[var(--chat-text-muted)]">{metric.label}</dt>
          <dd className="shrink-0 text-sm font-semibold text-[var(--chat-text)]">{metric.value}</dd>
        </div>
      ))}
    </dl>

    <Link
      to={to}
      className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
    >
      {actionLabel}
      <ExternalLink aria-hidden="true" className="h-4 w-4" />
    </Link>
  </article>
);

const StatusPill = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex min-h-8 shrink-0 items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 text-xs font-semibold text-[var(--chat-text-muted)]">
    {children}
  </span>
);

export default AdminHub;
