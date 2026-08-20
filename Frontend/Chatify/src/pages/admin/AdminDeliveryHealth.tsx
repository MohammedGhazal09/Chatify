import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  DeliveryHealthPayload,
  DeliveryHealthRiskConversation,
  DeliveryHealthStatus,
  DeliveryHealthWindowKey,
} from '../../api/deliveryHealthApi';
import { useDeliveryHealth } from '../../hooks/useDeliveryHealth';
import { useLocale, type TranslationKey } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { useChatTheme } from '../chat/hooks/useChatTheme';
import '../chat/chat.css';

const windowOptions: Array<{ value: DeliveryHealthWindowKey; labelKey: TranslationKey }> = [
  { value: '1h', labelKey: 'admin.deliveryHealth.window.1h' },
  { value: '24h', labelKey: 'admin.deliveryHealth.window.24h' },
  { value: '7d', labelKey: 'admin.deliveryHealth.window.7d' },
];

const statusLabels: Record<DeliveryHealthStatus, TranslationKey> = {
  ok: 'admin.deliveryHealth.status.ok',
  degraded: 'admin.deliveryHealth.status.degraded',
  blocked: 'admin.deliveryHealth.status.blocked',
};

const kindLabels: Record<DeliveryHealthRiskConversation['kind'], TranslationKey> = {
  direct: 'admin.deliveryHealth.kind.direct',
  group: 'admin.deliveryHealth.kind.group',
  space_channel: 'admin.deliveryHealth.kind.spaceChannel',
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

const formatChatLabel = (chatId: string | null) => (
  chatId ? `#${chatId.slice(-6)}` : '#------'
);

const AdminDeliveryHealth = () => {
  const user = useAuthStore((state) => state.user);
  const { direction, t, formatDateTime } = useLocale();
  const chatTheme = useChatTheme(user?._id);
  const [windowKey, setWindowKey] = useState<DeliveryHealthWindowKey>('24h');
  const deliveryHealthQuery = useDeliveryHealth(windowKey);
  const deliveryHealth = deliveryHealthQuery.data;
  const generatedAt = deliveryHealth?.generatedAt
    ? t('admin.deliveryHealth.generatedAt', {
        values: {
          date: formatDateTime(deliveryHealth.generatedAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        },
      })
    : t('date.unknown');

  const summaryMetrics = useMemo(() => {
    if (!deliveryHealth) {
      return [];
    }

    return [
      { label: t('admin.deliveryHealth.totalMessages'), value: deliveryHealth.summary.totalMessages, icon: <MessageCircle aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.sent'), value: deliveryHealth.summary.sent, icon: <Clock3 aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.delivered'), value: deliveryHealth.summary.delivered, icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.read'), value: deliveryHealth.summary.read, icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.staleSent'), value: deliveryHealth.summary.staleSent, icon: <AlertTriangle aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.staleDelivered'), value: deliveryHealth.summary.staleDelivered, icon: <AlertTriangle aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.deliveryRate'), value: formatPercent(deliveryHealth.summary.deliveryRate), icon: <Activity aria-hidden="true" className="h-4 w-4" /> },
      { label: t('admin.deliveryHealth.readRate'), value: formatPercent(deliveryHealth.summary.readRate), icon: <Activity aria-hidden="true" className="h-4 w-4" /> },
    ];
  }, [deliveryHealth, t]);

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
                <h1 className="text-lg font-semibold">{t('admin.deliveryHealth.accessRequiredTitle')}</h1>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">{t('admin.deliveryHealth.accessRequiredDescription')}</p>
              </div>
            </div>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('admin.deliveryHealth.backToChat')}
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
                to="/"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label={t('admin.deliveryHealth.backToChat')}
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]">{t('admin.deliveryHealth.eyebrow')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold">{t('admin.deliveryHealth.title')}</h1>
                  {deliveryHealth && <StatusBadge status={deliveryHealth.summary.status}>{t(statusLabels[deliveryHealth.summary.status])}</StatusBadge>}
                </div>
                <p className="mt-1 text-xs text-[var(--chat-text-muted)]">{generatedAt}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex min-h-10 overflow-hidden rounded-[var(--chat-radius-md)] border border-[var(--chat-border)]" aria-label={t('admin.deliveryHealth.windowLabel')}>
                {windowOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={windowKey === option.value}
                    onClick={() => setWindowKey(option.value)}
                    className={`min-w-[74px] px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chat-focus)] ${
                      windowKey === option.value
                        ? 'bg-[var(--chat-accent)] text-[var(--chat-own-text)]'
                        : 'bg-[var(--chat-panel)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)]'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => deliveryHealthQuery.refetch()}
                disabled={deliveryHealthQuery.isFetching}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-sm font-semibold text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${deliveryHealthQuery.isFetching ? 'motion-safe:animate-spin' : ''}`} />
                {t('admin.deliveryHealth.refresh')}
              </button>
            </div>
          </div>
        </header>

        {deliveryHealthQuery.isLoading ? (
          <StateMessage icon={<Activity aria-hidden="true" className="h-5 w-5" />} title={t('admin.deliveryHealth.loading')} />
        ) : deliveryHealthQuery.isError ? (
          <StateMessage
            icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
            title={t('admin.deliveryHealth.unavailable')}
            role="alert"
          />
        ) : deliveryHealth ? (
          <DeliveryHealthContent
            deliveryHealth={deliveryHealth}
            formatDateTime={formatDateTime}
            summaryMetrics={summaryMetrics}
            t={t}
          />
        ) : null}
      </main>
    </div>
  );
};

const DeliveryHealthContent = ({
  deliveryHealth,
  formatDateTime,
  summaryMetrics,
  t,
}: {
  deliveryHealth: DeliveryHealthPayload;
  formatDateTime: ReturnType<typeof useLocale>['formatDateTime'];
  summaryMetrics: Array<{ label: string; value: string | number; icon: ReactNode }>;
  t: ReturnType<typeof useLocale>['t'];
}) => (
  <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6">
    <section aria-label={t('admin.deliveryHealth.summaryLabel')}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summaryMetrics.map((metric) => (
          <Metric key={metric.label} label={metric.label} value={metric.value} icon={metric.icon} />
        ))}
      </div>
    </section>

    <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <section className="min-w-0 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)]" aria-label={t('admin.deliveryHealth.riskLabel')}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--chat-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-[var(--chat-warning)]" />
            <h2 className="text-sm font-semibold">{t('admin.deliveryHealth.riskLabel')}</h2>
          </div>
          <StatusBadge status={deliveryHealth.summary.status}>{t(statusLabels[deliveryHealth.summary.status])}</StatusBadge>
        </div>

        {deliveryHealth.riskConversations.length === 0 ? (
          <div className="grid min-h-[260px] place-items-center px-4 text-center text-sm text-[var(--chat-text-muted)]">
            <div>
              <CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--chat-success)]" />
              <p className="mt-3 font-semibold text-[var(--chat-text)]">{t('admin.deliveryHealth.noRisk')}</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--chat-border)]">
            {deliveryHealth.riskConversations.map((conversation) => (
              <RiskRow
                key={conversation.chatId ?? conversation.latestActivityAt ?? conversation.riskScore}
                conversation={conversation}
                formatDateTime={formatDateTime}
                t={t}
              />
            ))}
          </ul>
        )}
      </section>

      <aside className="grid content-start gap-4">
        <DiagnosticsPanel
          icon={<Server aria-hidden="true" className="h-4 w-4" />}
          title={t('admin.deliveryHealth.runtimeLabel')}
          status={deliveryHealth.runtime.status}
          statusLabel={t(statusLabels[deliveryHealth.runtime.status])}
        >
          <DetailLine label={t('admin.deliveryHealth.socketInitialized')} value={deliveryHealth.runtime.socket.initialized ? t('admin.deliveryHealth.yes') : t('admin.deliveryHealth.no')} />
          <DetailLine label={t('admin.deliveryHealth.connectedUsers')} value={deliveryHealth.runtime.socket.connectedUsers} />
          <DetailLine label={t('admin.deliveryHealth.connectedSockets')} value={deliveryHealth.runtime.socket.connectedSockets} />
          <DetailLine label={t('admin.deliveryHealth.pendingCalls')} value={deliveryHealth.runtime.socket.pendingCallTimeouts} />
          <DetailLine label={t('admin.deliveryHealth.pendingDisconnects')} value={deliveryHealth.runtime.socket.pendingCallDisconnectCleanups} />
        </DiagnosticsPanel>

        <DiagnosticsPanel
          icon={<BellRing aria-hidden="true" className="h-4 w-4" />}
          title={t('admin.deliveryHealth.outboxLabel')}
          status={deliveryHealth.outbox.status}
          statusLabel={t(statusLabels[deliveryHealth.outbox.status])}
        >
          <DetailLine label={t('admin.deliveryHealth.outboxTotal')} value={deliveryHealth.outbox.total} />
          <DetailLine label={t('admin.deliveryHealth.outboxAttempts')} value={deliveryHealth.outbox.attempts} />
          <DetailLine label={t('admin.deliveryHealth.pending')} value={deliveryHealth.outbox.byStatus.pending} />
          <DetailLine label={t('admin.deliveryHealth.processing')} value={deliveryHealth.outbox.byStatus.processing} />
          <DetailLine label={t('admin.deliveryHealth.failed')} value={deliveryHealth.outbox.byStatus.failed} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <ChannelSummary label={t('admin.deliveryHealth.email')} failedLabel={t('admin.deliveryHealth.failed')} total={deliveryHealth.outbox.byChannel.email.total} failed={deliveryHealth.outbox.byChannel.email.byStatus.failed} />
            <ChannelSummary label={t('admin.deliveryHealth.push')} failedLabel={t('admin.deliveryHealth.failed')} total={deliveryHealth.outbox.byChannel.push.total} failed={deliveryHealth.outbox.byChannel.push.byStatus.failed} />
          </div>
        </DiagnosticsPanel>
      </aside>
    </div>
  </div>
);

const RiskRow = ({
  conversation,
  formatDateTime,
  t,
}: {
  conversation: DeliveryHealthRiskConversation;
  formatDateTime: ReturnType<typeof useLocale>['formatDateTime'];
  t: ReturnType<typeof useLocale>['t'];
}) => (
  <li className="px-4 py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          <MessageCircle aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
          {t('admin.deliveryHealth.conversation')} {formatChatLabel(conversation.chatId)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <Badge>{t(kindLabels[conversation.kind])}</Badge>
          <Badge>
            <Users aria-hidden="true" className="h-3 w-3" />
            {conversation.memberCount} {t('admin.deliveryHealth.members')}
          </Badge>
          {conversation.flags.hasStaleSent && <Badge tone="warning">{t('admin.deliveryHealth.staleSent')}</Badge>}
          {conversation.flags.hasStaleDelivered && <Badge tone="danger">{t('admin.deliveryHealth.staleDelivered')}</Badge>}
        </div>
      </div>
      <p className="text-xs text-[var(--chat-text-muted)]">
        {t('admin.deliveryHealth.latestActivity')}: {formatDateTime(conversation.latestActivityAt, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </p>
    </div>
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
      <MiniMetric label={t('admin.deliveryHealth.recent')} value={conversation.recentMessages} />
      <MiniMetric label={t('admin.deliveryHealth.staleSent')} value={conversation.staleSent} />
      <MiniMetric label={t('admin.deliveryHealth.staleDelivered')} value={conversation.staleDelivered} />
      <MiniMetric label={t('admin.deliveryHealth.unreadEstimate')} value={conversation.unreadEstimate} />
    </dl>
  </li>
);

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
    <p className="mt-2 text-2xl font-semibold text-[var(--chat-text)]">{value}</p>
  </div>
);

const MiniMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2">
    <dt className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</dt>
    <dd className="mt-1 text-base font-semibold">{value}</dd>
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
  status: DeliveryHealthStatus | Exclude<DeliveryHealthStatus, 'blocked'>;
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
    <span className="text-[var(--chat-text-muted)]">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);

const ChannelSummary = ({ label, total, failed, failedLabel }: { label: string; total: number; failed: number; failedLabel: string }) => (
  <div className="rounded-[var(--chat-radius-sm)] border border-[var(--chat-border)] px-3 py-2 text-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      <span className="text-[var(--chat-text-muted)]">{total}</span>
    </div>
    <p className="mt-1 text-xs text-[var(--chat-text-muted)]">{failed} {failedLabel}</p>
  </div>
);

const StatusBadge = ({ status, children }: { status: DeliveryHealthStatus | Exclude<DeliveryHealthStatus, 'blocked'>; children: ReactNode }) => {
  const toneClass = status === 'blocked'
    ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_12%,var(--chat-panel))] text-[var(--chat-danger)]'
    : status === 'degraded'
      ? 'border-[color-mix(in_srgb,var(--chat-warning)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-warning)_12%,var(--chat-panel))] text-[var(--chat-warning)]'
      : 'border-[color-mix(in_srgb,var(--chat-success)_42%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-success)_10%,var(--chat-panel))] text-[var(--chat-success)]';

  return (
    <span className={`inline-flex min-h-6 items-center rounded-[var(--chat-radius-sm)] border px-2 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
};

const Badge = ({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'danger' | 'warning' }) => {
  const toneClass = tone === 'danger'
    ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] text-[var(--chat-danger)]'
    : tone === 'warning'
      ? 'border-[color-mix(in_srgb,var(--chat-warning)_45%,var(--chat-border))] text-[var(--chat-warning)]'
      : 'border-[var(--chat-border)] text-[var(--chat-text-muted)]';

  return (
    <span className={`inline-flex min-h-6 items-center gap-1 rounded-[var(--chat-radius-sm)] border px-2 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
};

export default AdminDeliveryHealth;
