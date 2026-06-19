import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Inbox, RefreshCw, ShieldCheck } from 'lucide-react';
import type {
  AbuseReport,
  AbuseReportStatus,
  ModerationAction,
} from '../../api/moderationApi';
import {
  useModerationReport,
  useModerationReports,
  useReviewModerationReport,
  type ModerationStatusFilter,
} from '../../hooks/useModerationReports';
import { useAuthStore } from '../../store/authstore';
import { useChatTheme } from '../chat/hooks/useChatTheme';
import '../chat/chat.css';

type ReviewStatus = Exclude<AbuseReportStatus, 'open'>;

const statusFilters: Array<{ value: ModerationStatusFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'action_taken', label: 'Action taken' },
  { value: 'all', label: 'All' },
];

const reviewStatusOptions: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'action_taken', label: 'Action taken' },
];

const moderationActionOptions: Array<{ value: ModerationAction; label: string }> = [
  { value: 'none', label: 'No enforcement' },
  { value: 'warned', label: 'Warn user' },
  { value: 'restricted', label: 'Restrict messaging' },
  { value: 'restriction_lifted', label: 'Lift restriction' },
  { value: 'content_removed', label: 'Remove reported content' },
  { value: 'account_review', label: 'Account review' },
];

const actionRequiresTaken = new Set<ModerationAction>([
  'warned',
  'restricted',
  'restriction_lifted',
  'content_removed',
]);

const statusLabels: Record<AbuseReportStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
  action_taken: 'Action taken',
};

const priorityLabels: Record<AbuseReport['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  normal: 'Normal',
};

const formatAge = (value?: string) => {
  if (!value) {
    return 'Unknown age';
  }

  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) {
    return 'Unknown age';
  }

  const minutes = Math.max(1, Math.floor((Date.now() - createdAt) / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
};

const formatDate = (value?: string) => {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getIdentityLabel = (
  identity: AbuseReport['reporterIdentity'] | AbuseReport['reportedUserIdentity'],
  fallback: string
) => identity?.displayName || identity?.username || fallback;

const getErrorMessage = (error: unknown, fallback: string) => (
  axios.isAxiosError(error)
    ? error.response?.data?.message ?? fallback
    : fallback
);

const getDefaultReviewStatus = (report: AbuseReport | null): ReviewStatus => (
  report?.status && report.status !== 'open' ? report.status : 'reviewed'
);

const AdminModeration = () => {
  const user = useAuthStore((state) => state.user);
  const chatTheme = useChatTheme(user?._id);
  const [statusFilter, setStatusFilter] = useState<ModerationStatusFilter>('open');
  const reportsQuery = useModerationReports(statusFilter);
  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedFallback = useMemo(
    () => reports.find((report) => report._id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );
  const reportQuery = useModerationReport(selectedReportId);
  const selectedReport = reportQuery.data ?? selectedFallback;
  const reviewMutation = useReviewModerationReport();
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('reviewed');
  const [moderationAction, setModerationAction] = useState<ModerationAction>('none');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedReportId && reports.length > 0) {
      setSelectedReportId(reports[0]._id);
    }
  }, [reports, selectedReportId]);

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    setReviewStatus(getDefaultReviewStatus(selectedReport));
    setModerationAction(selectedReport.moderationAction ?? 'none');
    setNote(selectedReport.moderationNote ?? '');
  }, [selectedReport]);

  if (user?.role !== 'admin') {
    return (
      <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
        <main className="grid min-h-[100dvh] place-items-center bg-[var(--chat-bg)] px-4 text-[var(--chat-text)]">
          <section className="w-full max-w-md rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-5 shadow-[var(--chat-shadow)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-danger)]">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold">Admin access required</h1>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">This workspace is restricted to moderation admins.</p>
              </div>
            </div>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back to chat
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const handleActionChange = (nextAction: ModerationAction) => {
    setModerationAction(nextAction);

    if (actionRequiresTaken.has(nextAction)) {
      setReviewStatus('action_taken');
    }
  };

  const handleStatusChange = (nextStatus: ReviewStatus) => {
    setReviewStatus(nextStatus);

    if (nextStatus !== 'action_taken' && actionRequiresTaken.has(moderationAction)) {
      setModerationAction('none');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedReport) {
      return;
    }

    setNotice(null);
    reviewMutation.mutate(
      {
        reportId: selectedReport._id,
        payload: {
          status: reviewStatus,
          moderationAction,
          note,
        },
      },
      {
        onSuccess: () => setNotice('Review saved.'),
        onError: (error) => setNotice(getErrorMessage(error, 'Could not save the moderation review.')),
      }
    );
  };

  return (
    <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
      <main className="flex min-h-[100dvh] flex-col bg-[var(--chat-bg)] text-[var(--chat-text)]">
        <header className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label="Back to chat"
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]">Admin</p>
                <h1 className="truncate text-xl font-semibold">Moderation</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => reportsQuery.refetch()}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-sm font-semibold text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-h-0 border-b border-[var(--chat-border)] bg-[var(--chat-panel)] md:border-b-0 md:border-r" aria-label="Report queue">
            <div className="border-b border-[var(--chat-border)] p-3">
              <div className="flex flex-wrap gap-2" aria-label="Report status filters">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={statusFilter === filter.value}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setSelectedReportId(null);
                      setNotice(null);
                    }}
                    className={`min-h-9 rounded-[var(--chat-radius-md)] border px-3 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                      statusFilter === filter.value
                        ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                        : 'border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-full min-h-[280px] overflow-y-auto">
              {reportsQuery.isLoading ? (
                <QueueState icon={<Inbox aria-hidden="true" className="h-5 w-5" />} title="Loading reports" />
              ) : reportsQuery.isError ? (
                <QueueState
                  icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
                  title="Reports unavailable"
                  description={getErrorMessage(reportsQuery.error, 'Could not load moderation reports.')}
                  role="alert"
                />
              ) : reports.length === 0 ? (
                <QueueState icon={<Inbox aria-hidden="true" className="h-5 w-5" />} title="No reports match this filter" />
              ) : (
                <ul className="divide-y divide-[var(--chat-border)]">
                  {reports.map((report) => {
                    const isSelected = selectedReportId === report._id;
                    const reporterLabel = getIdentityLabel(report.reporterIdentity, `Reporter ${report.reporter?.slice(-6) ?? ''}`.trim());
                    const reportedLabel = getIdentityLabel(report.reportedUserIdentity, 'No reported user');

                    return (
                      <li key={report._id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReportId(report._id);
                            setNotice(null);
                          }}
                          className={`flex min-h-[104px] w-full flex-col gap-2 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chat-focus)] ${
                            isSelected
                              ? 'bg-[var(--chat-accent-soft)]'
                              : 'hover:bg-[var(--chat-panel-subtle)]'
                          }`}
                          aria-label={`${priorityLabels[report.priority]} priority ${report.targetType} report from ${reporterLabel}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--chat-text)]">{reportedLabel}</span>
                            <span className="shrink-0 text-xs text-[var(--chat-text-soft)]">{formatAge(report.createdAt)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <Badge tone={report.priority === 'high' ? 'danger' : report.priority === 'medium' ? 'warning' : 'default'}>
                              {priorityLabels[report.priority]}
                            </Badge>
                            <Badge>{statusLabels[report.status]}</Badge>
                            <Badge>{report.targetType}</Badge>
                          </div>
                          <p className="truncate text-xs text-[var(--chat-text-muted)]">From {reporterLabel} - {report.reason}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto bg-[var(--chat-bg)] px-4 py-4 md:px-6" aria-label="Report detail">
            {!selectedReport ? (
              <div className="grid min-h-[360px] place-items-center text-center text-sm text-[var(--chat-text-muted)]">
                <div>
                  <Inbox aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--chat-text-soft)]" />
                  <p className="mt-3 font-semibold text-[var(--chat-text)]">Select a report</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Badge tone={selectedReport.priority === 'high' ? 'danger' : selectedReport.priority === 'medium' ? 'warning' : 'default'}>
                          {priorityLabels[selectedReport.priority]}
                        </Badge>
                        <Badge>{statusLabels[selectedReport.status]}</Badge>
                        <Badge>{selectedReport.targetType}</Badge>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">
                        {getIdentityLabel(selectedReport.reportedUserIdentity, 'Reported target')}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--chat-text-muted)]">
                        Reported by {getIdentityLabel(selectedReport.reporterIdentity, `Reporter ${selectedReport.reporter?.slice(-6) ?? ''}`.trim())} - {formatDate(selectedReport.createdAt)}
                      </p>
                    </div>
                    {reportQuery.isFetching && (
                      <span className="inline-flex items-center gap-2 text-xs text-[var(--chat-text-muted)]" role="status">
                        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
                        Loading detail
                      </span>
                    )}
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <DetailItem label="Reason" value={selectedReport.reason} />
                    <DetailItem label="Chat" value={selectedReport.context?.chat?.chatId ?? 'Not linked'} />
                    <DetailItem label="Message" value={selectedReport.context?.message?.messageId ?? 'Not linked'} />
                  </dl>

                  {selectedReport.details && (
                    <div className="mt-4 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
                      <p className="text-xs font-semibold text-[var(--chat-text-muted)]">Reporter details</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{selectedReport.details}</p>
                    </div>
                  )}

                  {selectedReport.context?.message && (
                    <div className="mt-4 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
                      <p className="text-xs font-semibold text-[var(--chat-text-muted)]">Redacted message context</p>
                      <p className="mt-1 text-sm leading-6">{selectedReport.context.message.textPreview || 'No message preview stored'}</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Status
                      <select
                        value={reviewStatus}
                        onChange={(event) => handleStatusChange(event.target.value as ReviewStatus)}
                        className="mt-1 min-h-10 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 text-sm font-normal text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {reviewStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      Enforcement
                      <select
                        value={moderationAction}
                        onChange={(event) => handleActionChange(event.target.value as ModerationAction)}
                        className="mt-1 min-h-10 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 text-sm font-normal text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {moderationActionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 block text-sm font-semibold">
                    Reviewer note
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={4}
                      className="mt-1 w-full resize-y rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm font-normal leading-6 text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="submit"
                      disabled={reviewMutation.isPending}
                      className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                    >
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      Save review
                    </button>
                    {notice && (
                      <p
                        className={`text-sm font-medium ${notice === 'Review saved.' ? 'text-[var(--chat-success)]' : 'text-[var(--chat-danger)]'}`}
                        role={notice === 'Review saved.' ? 'status' : 'alert'}
                      >
                        {notice}
                      </p>
                    )}
                  </div>
                </form>

                <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4" aria-label="Audit trail">
                  <h3 className="text-sm font-semibold">Audit trail</h3>
                  {selectedReport.auditTrail.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--chat-text-muted)]">No review events recorded.</p>
                  ) : (
                    <ol className="mt-3 divide-y divide-[var(--chat-border)]">
                      {selectedReport.auditTrail.map((entry, index) => (
                        <li key={`${entry.createdAt ?? index}-${entry.actor ?? 'actor'}`} className="py-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{statusLabels[entry.status]}</Badge>
                            <Badge>{entry.moderationAction}</Badge>
                            <span className="text-xs text-[var(--chat-text-soft)]">{formatDate(entry.createdAt)}</span>
                          </div>
                          {entry.note && <p className="mt-2 whitespace-pre-wrap leading-6 text-[var(--chat-text-muted)]">{entry.note}</p>}
                          {entry.enforcement?.summary && (
                            <p className="mt-1 text-xs font-medium text-[var(--chat-accent)]">{entry.enforcement.summary}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

const QueueState = ({
  icon,
  title,
  description,
  role = 'status',
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  role?: 'status' | 'alert';
}) => (
  <div className="grid min-h-[280px] place-items-center px-4 text-center text-sm text-[var(--chat-text-muted)]" role={role}>
    <div>
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-text-soft)]">
        {icon}
      </span>
      <p className="mt-3 font-semibold text-[var(--chat-text)]">{title}</p>
      {description && <p className="mt-1">{description}</p>}
    </div>
  </div>
);

const Badge = ({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'danger' | 'warning' }) => {
  const toneClass = tone === 'danger'
    ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] text-[var(--chat-danger)]'
    : tone === 'warning'
      ? 'border-[color-mix(in_srgb,var(--chat-warning)_45%,var(--chat-border))] text-[var(--chat-warning)]'
      : 'border-[var(--chat-border)] text-[var(--chat-text-muted)]';

  return (
    <span className={`inline-flex min-h-6 items-center rounded-[var(--chat-radius-sm)] border px-2 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
    <dt className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</dt>
    <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
  </div>
);

export default AdminModeration;
