import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Inbox, RefreshCw, Scale, ShieldCheck, UserCheck } from 'lucide-react';
import type {
  AbuseReport,
  AbuseReportStatus,
  ModerationAppealStatus,
  ModerationAction,
} from '../../api/moderationApi';
import {
  useAssignModerationReport,
  useModerationOpsSummary,
  useModerationReport,
  useModerationReports,
  useReviewModerationAppeal,
  useReviewModerationReport,
  useUserEnforcementHistory,
  type ModerationStatusFilter,
} from '../../hooks/useModerationReports';
import { useLocale, type TranslationKey } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { useChatTheme } from '../chat/hooks/useChatTheme';
import '../chat/chat.css';

type ReviewStatus = Exclude<AbuseReportStatus, 'open'>;

const statusFilters: Array<{ value: ModerationStatusFilter; labelKey: TranslationKey }> = [
  { value: 'open', labelKey: 'admin.moderation.status.open' },
  { value: 'reviewed', labelKey: 'admin.moderation.status.reviewed' },
  { value: 'dismissed', labelKey: 'admin.moderation.status.dismissed' },
  { value: 'action_taken', labelKey: 'admin.moderation.status.actionTaken' },
  { value: 'all', labelKey: 'admin.moderation.status.all' },
];

const reviewStatusOptions: Array<{ value: ReviewStatus; labelKey: TranslationKey }> = [
  { value: 'reviewed', labelKey: 'admin.moderation.status.reviewed' },
  { value: 'dismissed', labelKey: 'admin.moderation.status.dismissed' },
  { value: 'action_taken', labelKey: 'admin.moderation.status.actionTaken' },
];

const moderationActionOptions: Array<{ value: ModerationAction; labelKey: TranslationKey }> = [
  { value: 'none', labelKey: 'admin.moderation.action.none' },
  { value: 'warned', labelKey: 'admin.moderation.action.warned' },
  { value: 'restricted', labelKey: 'admin.moderation.action.restricted' },
  { value: 'restriction_lifted', labelKey: 'admin.moderation.action.restrictionLifted' },
  { value: 'content_removed', labelKey: 'admin.moderation.action.contentRemoved' },
  { value: 'account_review', labelKey: 'admin.moderation.action.accountReview' },
];

const appealStatusOptions: Array<{ value: Exclude<ModerationAppealStatus, 'open'>; labelKey: TranslationKey }> = [
  { value: 'under_review', labelKey: 'admin.moderation.status.underReview' },
  { value: 'accepted', labelKey: 'admin.moderation.status.acceptAppeal' },
  { value: 'rejected', labelKey: 'admin.moderation.status.rejectAppeal' },
];

const actionRequiresTaken = new Set<ModerationAction>([
  'warned',
  'restricted',
  'restriction_lifted',
  'content_removed',
]);

const statusLabels: Record<AbuseReportStatus, TranslationKey> = {
  open: 'admin.moderation.status.open',
  reviewed: 'admin.moderation.status.reviewed',
  dismissed: 'admin.moderation.status.dismissed',
  action_taken: 'admin.moderation.status.actionTaken',
};

const priorityLabels: Record<AbuseReport['priority'], TranslationKey> = {
  high: 'admin.moderation.priority.high',
  medium: 'admin.moderation.priority.medium',
  normal: 'admin.moderation.priority.normal',
};

const moderationActionLabels: Record<ModerationAction, TranslationKey> = {
  none: 'admin.moderation.action.none',
  warned: 'admin.moderation.action.warned',
  restricted: 'admin.moderation.action.restricted',
  restriction_lifted: 'admin.moderation.action.restrictionLifted',
  content_removed: 'admin.moderation.action.contentRemoved',
  account_review: 'admin.moderation.action.accountReview',
};

const appealStatusLabels: Record<ModerationAppealStatus, TranslationKey> = {
  open: 'admin.moderation.status.open',
  under_review: 'admin.moderation.status.underReview',
  accepted: 'admin.moderation.status.acceptAppeal',
  rejected: 'admin.moderation.status.rejectAppeal',
};

const formatAge = (value: string | undefined, unknownAgeLabel: string) => {
  if (!value) {
    return unknownAgeLabel;
  }

  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) {
    return unknownAgeLabel;
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
  const { direction, t, formatDateTime } = useLocale();
  const chatTheme = useChatTheme(user?._id);
  const [statusFilter, setStatusFilter] = useState<ModerationStatusFilter>('open');
  const opsSummaryQuery = useModerationOpsSummary();
  const reportsQuery = useModerationReports(statusFilter);
  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedFallback = useMemo(
    () => reports.find((report) => report._id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );
  const reportQuery = useModerationReport(selectedReportId);
  const selectedReport = reportQuery.data ?? selectedFallback;
  const selectedReportedUserId = selectedReport?.reportedUser ?? selectedReport?.reportedUserIdentity?.userId ?? null;
  const enforcementHistoryQuery = useUserEnforcementHistory(selectedReportedUserId);
  const reviewMutation = useReviewModerationReport();
  const assignMutation = useAssignModerationReport();
  const appealReviewMutation = useReviewModerationAppeal();
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('reviewed');
  const [moderationAction, setModerationAction] = useState<ModerationAction>('none');
  const [note, setNote] = useState('');
  const [appealStatus, setAppealStatus] = useState<Exclude<ModerationAppealStatus, 'open'>>('under_review');
  const [appealNote, setAppealNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [assignmentNotice, setAssignmentNotice] = useState<string | null>(null);
  const [appealNotice, setAppealNotice] = useState<string | null>(null);
  const reviewSavedMessage = t('admin.moderation.reviewSaved');
  const assignedToYouMessage = t('admin.moderation.assignedToYou');
  const appealReviewSavedMessage = t('admin.moderation.appealReviewSaved');
  const formatAdminDate = (value?: string) => formatDateTime(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const formatAdminAge = (value?: string) => formatAge(value, t('admin.moderation.unknownAge'));
  const activeAppeal = useMemo(() => {
    const appeals = selectedReport?.appeals ?? [];
    return appeals.find((appeal) => appeal.status === 'open' || appeal.status === 'under_review') ?? appeals.at(-1) ?? null;
  }, [selectedReport?.appeals]);

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

  useEffect(() => {
    setAssignmentNotice(null);
    setAppealNotice(null);
  }, [selectedReportId]);

  useEffect(() => {
    if (!activeAppeal) {
      setAppealStatus('under_review');
      setAppealNote('');
      return;
    }

    setAppealStatus(activeAppeal.status === 'open' ? 'under_review' : activeAppeal.status);
    setAppealNote(activeAppeal.reviewerNote ?? '');
  }, [activeAppeal]);

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
                <h1 className="text-lg font-semibold">{t('admin.moderation.accessRequiredTitle')}</h1>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">{t('admin.moderation.accessRequiredDescription')}</p>
              </div>
            </div>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('admin.moderation.backToChat')}
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
        onSuccess: () => setNotice(reviewSavedMessage),
        onError: (error) => setNotice(getErrorMessage(error, t('admin.moderation.couldNotSaveReview'))),
      }
    );
  };

  const handleAssignToMe = () => {
    if (!selectedReport) {
      return;
    }

    setAssignmentNotice(null);
    assignMutation.mutate(
      { reportId: selectedReport._id },
      {
        onSuccess: () => setAssignmentNotice(assignedToYouMessage),
        onError: (error) => setAssignmentNotice(getErrorMessage(error, t('admin.moderation.couldNotAssign'))),
      }
    );
  };

  const handleAppealReview = () => {
    if (!selectedReport || !activeAppeal) {
      return;
    }

    setAppealNotice(null);
    appealReviewMutation.mutate(
      {
        reportId: selectedReport._id,
        appealId: activeAppeal._id,
        payload: {
          status: appealStatus,
          reviewerNote: appealNote,
        },
      },
      {
        onSuccess: () => setAppealNotice(appealReviewSavedMessage),
        onError: (error) => setAppealNotice(getErrorMessage(error, t('admin.moderation.couldNotSaveAppealReview'))),
      }
    );
  };

  return (
    <div className="chat-theme-root min-h-[100dvh]" data-chat-theme={chatTheme.theme}>
      <main className="flex min-h-[100dvh] flex-col bg-[var(--chat-bg)] text-[var(--chat-text)]" dir={direction}>
        <header className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label={t('admin.moderation.backToChat')}
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]">{t('admin.moderation.eyebrow')}</p>
                <h1 className="truncate text-xl font-semibold">{t('admin.moderation.title')}</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => reportsQuery.refetch()}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-sm font-semibold text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {t('admin.moderation.refresh')}
            </button>
          </div>
        </header>

        <section className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 md:px-6" aria-label={t('admin.moderation.summaryLabel')}>
          {opsSummaryQuery.isLoading ? (
            <p className="inline-flex items-center gap-2 text-sm text-[var(--chat-text-muted)]" role="status">
              <BarChart3 aria-hidden="true" className="h-4 w-4" />
              {t('admin.moderation.loadingSummary')}
            </p>
          ) : opsSummaryQuery.isError ? (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--chat-warning)]" role="alert">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              {t('admin.moderation.summaryUnavailable')}
            </p>
          ) : opsSummaryQuery.data ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label={t('admin.moderation.openReports')} value={opsSummaryQuery.data.reportsByStatus.open} />
              <Metric label={t('admin.moderation.openAppeals')} value={opsSummaryQuery.data.appealsByStatus.open} />
              <Metric label={t('admin.moderation.unassigned')} value={opsSummaryQuery.data.unassignedOpen} />
              <Metric label={t('admin.moderation.assignedToMe')} value={opsSummaryQuery.data.assignedToMeOpen} />
              <Metric label={t('admin.moderation.oldestOpen')} value={`${opsSummaryQuery.data.oldestOpenAgeMinutes}m`} />
            </div>
          ) : null}
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-h-0 border-b border-[var(--chat-border)] bg-[var(--chat-panel)] md:border-b-0 md:border-e" aria-label={t('admin.moderation.reportQueue')}>
            <div className="border-b border-[var(--chat-border)] p-3">
              <div className="flex flex-wrap gap-2" aria-label={t('admin.moderation.reportStatusFilters')}>
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
                    {t(filter.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-full min-h-[280px] overflow-y-auto">
              {reportsQuery.isLoading ? (
                <QueueState icon={<Inbox aria-hidden="true" className="h-5 w-5" />} title={t('admin.moderation.loadingReports')} />
              ) : reportsQuery.isError ? (
                <QueueState
                  icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
                  title={t('admin.moderation.reportsUnavailable')}
                  description={getErrorMessage(reportsQuery.error, t('admin.moderation.couldNotLoadReports'))}
                  role="alert"
                />
              ) : reports.length === 0 ? (
                <QueueState icon={<Inbox aria-hidden="true" className="h-5 w-5" />} title={t('admin.moderation.noReports')} />
              ) : (
                <ul className="divide-y divide-[var(--chat-border)]">
                  {reports.map((report) => {
                    const isSelected = selectedReportId === report._id;
                    const reporterLabel = getIdentityLabel(
                      report.reporterIdentity,
                      t('admin.moderation.reporterFallback', { values: { id: report.reporter?.slice(-6) ?? '' } }).trim()
                    );
                    const reportedLabel = getIdentityLabel(report.reportedUserIdentity, t('admin.moderation.noReportedUser'));
                    const priorityLabel = t(priorityLabels[report.priority]);
                    const statusLabel = t(statusLabels[report.status]);

                    return (
                      <li key={report._id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReportId(report._id);
                            setNotice(null);
                          }}
                          className={`flex min-h-[104px] w-full flex-col gap-2 px-4 py-3 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chat-focus)] ${
                            isSelected
                              ? 'bg-[var(--chat-accent-soft)]'
                              : 'hover:bg-[var(--chat-panel-subtle)]'
                          }`}
                          aria-label={t('admin.moderation.reportButtonLabel', {
                            values: {
                              priority: priorityLabel,
                              targetType: report.targetType,
                              reporter: reporterLabel,
                            },
                          })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--chat-text)]">{reportedLabel}</span>
                            <span className="shrink-0 text-xs text-[var(--chat-text-soft)]">{formatAdminAge(report.createdAt)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <Badge tone={report.priority === 'high' ? 'danger' : report.priority === 'medium' ? 'warning' : 'default'}>
                              {priorityLabel}
                            </Badge>
                            <Badge>{statusLabel}</Badge>
                            <Badge>{report.targetType}</Badge>
                          </div>
                          <p className="truncate text-xs text-[var(--chat-text-muted)]">
                            {t('admin.moderation.fromReporter', { values: { reporter: reporterLabel, reason: report.reason } })}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto bg-[var(--chat-bg)] px-4 py-4 md:px-6" aria-label={t('admin.moderation.reportDetail')}>
            {!selectedReport ? (
              <div className="grid min-h-[360px] place-items-center text-center text-sm text-[var(--chat-text-muted)]">
                <div>
                  <Inbox aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--chat-text-soft)]" />
                  <p className="mt-3 font-semibold text-[var(--chat-text)]">{t('admin.moderation.selectReport')}</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Badge tone={selectedReport.priority === 'high' ? 'danger' : selectedReport.priority === 'medium' ? 'warning' : 'default'}>
                          {t(priorityLabels[selectedReport.priority])}
                        </Badge>
                        <Badge>{t(statusLabels[selectedReport.status])}</Badge>
                        <Badge>{selectedReport.targetType}</Badge>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">
                        {getIdentityLabel(selectedReport.reportedUserIdentity, t('admin.moderation.reportedTarget'))}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--chat-text-muted)]">
                        {t('admin.moderation.reportedBy', {
                          values: {
                            reporter: getIdentityLabel(
                              selectedReport.reporterIdentity,
                              t('admin.moderation.reporterFallback', { values: { id: selectedReport.reporter?.slice(-6) ?? '' } }).trim()
                            ),
                            date: formatAdminDate(selectedReport.createdAt),
                          },
                        })}
                      </p>
                    </div>
                    {reportQuery.isFetching && (
                      <span className="inline-flex items-center gap-2 text-xs text-[var(--chat-text-muted)]" role="status">
                        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
                        {t('admin.moderation.loadingDetail')}
                      </span>
                    )}
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <DetailItem label={t('admin.moderation.reason')} value={selectedReport.reason} />
                    <DetailItem label={t('admin.moderation.chat')} value={selectedReport.context?.chat?.chatId ?? t('admin.moderation.notLinked')} />
                    <DetailItem label={t('admin.moderation.message')} value={selectedReport.context?.message?.messageId ?? t('admin.moderation.notLinked')} />
                  </dl>

                  {selectedReport.details && (
                    <div className="mt-4 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
                      <p className="text-xs font-semibold text-[var(--chat-text-muted)]">{t('admin.moderation.reporterDetails')}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{selectedReport.details}</p>
                    </div>
                  )}

                  {selectedReport.context?.message && (
                    <div className="mt-4 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
                      <p className="text-xs font-semibold text-[var(--chat-text-muted)]">{t('admin.moderation.redactedMessageContext')}</p>
                      <p className="mt-1 text-sm leading-6">{selectedReport.context.message.textPreview || t('admin.moderation.noMessagePreview')}</p>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
                      <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--chat-text-muted)]">
                        <UserCheck aria-hidden="true" className="h-4 w-4" />
                        {t('admin.moderation.assignment')}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedReport.assignedToIdentity?.displayName ?? selectedReport.assignedToIdentity?.username ?? t('admin.moderation.unassigned')}
                      </p>
                      <button
                        type="button"
                        onClick={handleAssignToMe}
                        disabled={assignMutation.isPending}
                        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-sm font-semibold text-[var(--chat-text)] hover:bg-[var(--chat-panel)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        <UserCheck aria-hidden="true" className="h-4 w-4" />
                        {t('admin.moderation.assignToMe')}
                      </button>
                      {assignmentNotice && (
                        <p
                          className={`mt-2 text-xs font-medium ${assignmentNotice === assignedToYouMessage ? 'text-[var(--chat-success)]' : 'text-[var(--chat-danger)]'}`}
                          role={assignmentNotice === assignedToYouMessage ? 'status' : 'alert'}
                        >
                          {assignmentNotice}
                        </p>
                      )}
                    </div>

                    <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
                      <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--chat-text-muted)]">
                        <Scale aria-hidden="true" className="h-4 w-4" />
                        {t('admin.moderation.enforcementHistory')}
                      </p>
                      {enforcementHistoryQuery.isLoading ? (
                        <p className="mt-2 text-sm text-[var(--chat-text-muted)]" role="status">{t('admin.moderation.loadingHistory')}</p>
                      ) : enforcementHistoryQuery.data && enforcementHistoryQuery.data.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {enforcementHistoryQuery.data.slice(0, 3).map((item) => (
                            <li key={item._id} className="text-sm">
                              <span className="font-medium">{t(moderationActionLabels[item.moderationAction])}</span>
                              <span className="text-[var(--chat-text-muted)]"> - {formatAdminDate(item.reviewedAt)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--chat-text-muted)]">{t('admin.moderation.noPriorEnforcement')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {activeAppeal && (
                  <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4" aria-label={t('admin.moderation.appealReview')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{t('admin.moderation.appeal')}</h3>
                        <p className="mt-1 text-sm text-[var(--chat-text-muted)]">
                          {t(appealStatusLabels[activeAppeal.status])} - {formatAdminDate(activeAppeal.createdAt)}
                        </p>
                      </div>
                      <Badge tone={activeAppeal.status === 'open' ? 'warning' : activeAppeal.status === 'accepted' ? 'default' : 'danger'}>
                        {t(appealStatusLabels[activeAppeal.status])}
                      </Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3 text-sm leading-6">
                      {activeAppeal.reason}
                    </p>
                    {appealNotice && (
                      <p
                        className={`mt-3 text-sm font-medium ${appealNotice === appealReviewSavedMessage ? 'text-[var(--chat-success)]' : 'text-[var(--chat-danger)]'}`}
                        role={appealNotice === appealReviewSavedMessage ? 'status' : 'alert'}
                      >
                        {appealNotice}
                      </p>
                    )}
                    {(activeAppeal.status === 'open' || activeAppeal.status === 'under_review') && (
                      <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                        <label className="block text-sm font-semibold">
                          {t('admin.moderation.appealStatus')}
                          <select
                            value={appealStatus}
                            onChange={(event) => setAppealStatus(event.target.value as Exclude<ModerationAppealStatus, 'open'>)}
                            className="mt-1 min-h-10 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 text-sm font-normal text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                          >
                            {appealStatusOptions.map((option) => (
                              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold">
                          {t('admin.moderation.appealReviewerNote')}
                          <textarea
                            value={appealNote}
                            onChange={(event) => setAppealNote(event.target.value)}
                            rows={3}
                            className="mt-1 w-full resize-y rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm font-normal leading-6 text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                          />
                        </label>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleAppealReview}
                            disabled={appealReviewMutation.isPending}
                            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                          >
                            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                            {t('admin.moderation.saveAppealReview')}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <form onSubmit={handleSubmit} className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      {t('admin.moderation.status')}
                      <select
                        value={reviewStatus}
                        onChange={(event) => handleStatusChange(event.target.value as ReviewStatus)}
                        className="mt-1 min-h-10 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 text-sm font-normal text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {reviewStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      {t('admin.moderation.enforcement')}
                      <select
                        value={moderationAction}
                        onChange={(event) => handleActionChange(event.target.value as ModerationAction)}
                        className="mt-1 min-h-10 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 text-sm font-normal text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {moderationActionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 block text-sm font-semibold">
                    {t('admin.moderation.reviewerNote')}
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
                      {t('admin.moderation.saveReview')}
                    </button>
                    {notice && (
                      <p
                        className={`text-sm font-medium ${notice === reviewSavedMessage ? 'text-[var(--chat-success)]' : 'text-[var(--chat-danger)]'}`}
                        role={notice === reviewSavedMessage ? 'status' : 'alert'}
                      >
                        {notice}
                      </p>
                    )}
                  </div>
                </form>

                <section className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4" aria-label={t('admin.moderation.auditTrail')}>
                  <h3 className="text-sm font-semibold">{t('admin.moderation.auditTrail')}</h3>
                  {selectedReport.auditTrail.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--chat-text-muted)]">{t('admin.moderation.noReviewEvents')}</p>
                  ) : (
                    <ol className="mt-3 divide-y divide-[var(--chat-border)]">
                      {selectedReport.auditTrail.map((entry, index) => (
                        <li key={`${entry.createdAt ?? index}-${entry.actor ?? 'actor'}`} className="py-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{t(statusLabels[entry.status])}</Badge>
                            <Badge>{t(moderationActionLabels[entry.moderationAction])}</Badge>
                            <span className="text-xs text-[var(--chat-text-soft)]">{formatAdminDate(entry.createdAt)}</span>
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

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2">
    <p className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</p>
    <p className="mt-1 text-lg font-semibold text-[var(--chat-text)]">{value}</p>
  </div>
);

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3">
    <dt className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</dt>
    <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
  </div>
);

export default AdminModeration;
