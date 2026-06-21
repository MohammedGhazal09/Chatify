import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { AtSign, Bell, BellOff, Download, ImagePlus, Languages, LoaderCircle, Mail, Palette, RotateCcw, Scale, ShieldCheck, Trash2, UserRound, Volume2 } from 'lucide-react';
import { resolveApiBaseUrl } from '../api/apiOrigin';
import { useProfileImageMutation } from '../hooks/useProfileImageMutation';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useActiveSessions, useRevokeAllSessions, useRevokeSession } from '../hooks/useAuthQuery';
import {
  useCancelAccountDeletion,
  useExportAccountData,
  useRequestAccountDeletion,
  useUserPrivacySummary,
} from '../hooks/useUserPrivacy';
import {
  useMyModerationEnforcements,
  useSubmitModerationAppeal,
} from '../hooks/useModerationReports';
import IdentityMarkTile from '../pages/chat/components/IdentityMark';
import { useAuthStore } from '../store/authstore';
import {
  canRequestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../utils/notificationPrivacy';
import {
  getPushNotificationSupportStatus,
  subscribeToChatifyPushNotifications,
} from '../utils/pushNotifications';
import useLocalStorage from '../hooks/useLocalStorage';
import { supportedLocales, useLocale } from '../i18n';
import type { BrowserNotificationPermissionState } from '../types/notifications';
import type {
  IdentityMarkAccentId,
  IdentityMarkInput,
  IdentityMarkPaletteId,
  IdentityMarkPatternId,
} from '../types/auth';
import type { ChatTheme, ChatThemePreference } from '../pages/chat/hooks/useChatTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatTheme?: ChatTheme;
  chatThemePreference?: ChatThemePreference;
  isChatThemeForced?: boolean;
  onChatThemePreferenceChange?: (preference: ChatThemePreference) => void;
}

const themeOptions: Array<{ value: ChatThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PROFILE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PROFILE_BIO_MAX_LENGTH = 160;
const PROFILE_STATUS_MAX_LENGTH = 80;
const UNSAFE_PROFILE_TEXT_PATTERN = /(https?:\/\/|www\.|data:|javascript:|<|>|&lt;|&gt;)/i;
const IDENTITY_LABEL_MAX_LENGTH = 32;
const UNSAFE_IDENTITY_LABEL_PATTERN = /(https?:\/\/|data:|blob:|www\.|\/api\/|\b(human|person|people|face|avatar|portrait|body|silhouette|mascot|animal|cat|dog|bird|fish|horse|plant|tree|flower|leaf|leaves)\b)/i;

const identityPalettes: Array<{ id: IdentityMarkPaletteId; label: string; swatch: string }> = [
  { id: 'teal', label: 'Teal', swatch: '#0F766E' },
  { id: 'indigo', label: 'Indigo', swatch: '#4338CA' },
  { id: 'amber', label: 'Amber', swatch: '#92400E' },
  { id: 'slate', label: 'Slate', swatch: '#334155' },
  { id: 'rose', label: 'Rose', swatch: '#9F1239' },
];

const identityPatterns: Array<{ id: IdentityMarkPatternId; label: string }> = [
  { id: 'rings', label: 'Rings' },
  { id: 'grid', label: 'Grid' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'mono', label: 'Mono' },
];

const identityAccents: Array<{ id: IdentityMarkAccentId; label: string; swatch: string }> = [
  { id: 'mint', label: 'Mint', swatch: '#5EEAD4' },
  { id: 'sky', label: 'Sky', swatch: '#7DD3FC' },
  { id: 'gold', label: 'Gold', swatch: '#FBBF24' },
  { id: 'coral', label: 'Coral', swatch: '#FB7185' },
  { id: 'graphite', label: 'Graphite', swatch: '#CBD5E1' },
];

const moderationActionLabels = {
  none: 'No enforcement',
  warned: 'Warning',
  restricted: 'Messaging restriction',
  restriction_lifted: 'Restriction lifted',
  content_removed: 'Content removed',
  account_review: 'Account review',
} as const;

const abuseReasonLabels = {
  spam: 'Spam',
  harassment: 'Harassment',
  impersonation: 'Impersonation',
  privacy: 'Privacy',
  illegal: 'Illegal content',
  other: 'Other',
} as const;

const getUserDisplayName = (user: { firstName?: string; lastName?: string } | null) => {
  const displayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  return displayName || 'Current user';
};

const getIdentityInitials = (label: string) => {
  const initials = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join('')
    .toLocaleUpperCase();

  return initials || 'CU';
};

const getIdentityDraftForUser = (
  user: ReturnType<typeof useAuthStore.getState>['user']
): IdentityMarkInput => {
  const displayName = getUserDisplayName(user);
  const mark = user?.identityMark;

  return {
    label: mark?.label || displayName,
    initials: mark?.initials || getIdentityInitials(displayName),
    paletteId: mark?.paletteId || 'teal',
    patternId: mark?.patternId || 'grid',
    accentId: mark?.accentId || 'mint',
  };
};

const validateIdentityDraft = (draft: IdentityMarkInput) => {
  if (!draft.label.trim() || draft.label.trim().length > IDENTITY_LABEL_MAX_LENGTH) {
    return 'Identity label must be 1-32 characters.';
  }

  if (UNSAFE_IDENTITY_LABEL_PATTERN.test(draft.label)) {
    return 'Identity label cannot use URLs or living-being avatar concepts.';
  }

  if (!/^[\p{L}\p{N}]{1,3}$/u.test(draft.initials.trim())) {
    return 'Identity initials must be 1-3 letters or numbers.';
  }

  return null;
};

const resolveProfileImageSrc = (src?: string | null) => {
  if (!src) {
    return null;
  }

  if (/^(blob:|data:|https?:\/\/)/i.test(src)) {
    return src;
  }

  if (src.startsWith('/')) {
    return `${resolveApiBaseUrl()}${src}`;
  }

  return src;
};

const isUploadedProfileImage = (src?: string | null) => Boolean(src && src.includes('/api/user/') && src.includes('/profile-image'));

const validateProfileImageFile = (file: File) => {
  if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) {
    return 'Choose a PNG, JPG, or WebP image.';
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return 'Choose an image smaller than 2 MB.';
  }

  return null;
};

const getProfileDraftForUser = (user: ReturnType<typeof useAuthStore.getState>['user']) => ({
  profileBio: user?.profileBio ?? '',
  profileStatus: user?.profileStatus ?? '',
});

const normalizeProfileDraft = (draft: { profileBio: string; profileStatus: string }) => ({
  profileBio: draft.profileBio.trim().replace(/\s+/g, ' '),
  profileStatus: draft.profileStatus.trim().replace(/\s+/g, ' '),
});

const validateProfileDraft = (draft: { profileBio: string; profileStatus: string }) => {
  const normalized = normalizeProfileDraft(draft);

  if (normalized.profileBio.length > PROFILE_BIO_MAX_LENGTH) {
    return 'Profile bio must be 160 characters or fewer.';
  }

  if (normalized.profileStatus.length > PROFILE_STATUS_MAX_LENGTH) {
    return 'Profile status must be 80 characters or fewer.';
  }

  if (
    UNSAFE_PROFILE_TEXT_PATTERN.test(normalized.profileBio) ||
    UNSAFE_PROFILE_TEXT_PATTERN.test(normalized.profileStatus)
  ) {
    return 'Profile text must be plain text without links or unsafe characters.';
  }

  return null;
};

const getProfileImageErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const getPermissionStatusLabel = (permission: BrowserNotificationPermissionState) => {
  switch (permission) {
    case 'granted':
      return 'Allowed';
    case 'denied':
      return 'Blocked';
    case 'default':
      return 'Ask first';
    case 'unsupported':
      return 'Unavailable';
  }
};

const getModerationActionLabel = (action?: string) => (
  moderationActionLabels[action as keyof typeof moderationActionLabels] ?? action ?? 'Enforcement'
);

const getAbuseReasonLabel = (reason?: string) => (
  abuseReasonLabels[reason as keyof typeof abuseReasonLabels] ?? reason ?? 'Moderation'
);

const buildPrivacyExportFilename = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `chatify-account-export-${date}.json`;
};

const downloadJsonFile = (filename: string, payload: Record<string, unknown>) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const SettingsModal = ({
  isOpen,
  onClose,
  chatTheme = 'dark',
  chatThemePreference = 'system',
  isChatThemeForced = false,
  onChatThemePreferenceChange,
}: SettingsModalProps) => {
  const [enterToSend, setEnterToSend] = useLocalStorage('chatify_enter_to_send', true);
  const { locale, localeMeta, setLocale, t, formatDateTime } = useLocale();
  const currentUser = useAuthStore((state) => state.user);
  const activeSessionsQuery = useActiveSessions(isOpen);
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const privacySummaryQuery = useUserPrivacySummary(isOpen);
  const myEnforcementsQuery = useMyModerationEnforcements(isOpen && Boolean(currentUser?._id));
  const submitModerationAppeal = useSubmitModerationAppeal();
  const exportAccountData = useExportAccountData();
  const requestAccountDeletion = useRequestAccountDeletion();
  const cancelAccountDeletion = useCancelAccountDeletion();
  const {
    soundEnabled,
    browserNotificationsEnabled,
    pushEnabled,
    emailNotificationsEnabled,
    pushSubscriptionCount,
    mutedChatIds,
    isLoadingServerPreferences,
    isSavingServerPreferences,
    serverPreferenceError,
    setSoundEnabled,
    setBrowserNotificationsEnabled,
    setPushNotificationsEnabled,
    setEmailNotificationsEnabled,
    registerPushSubscription,
  } = useNotificationPreferences(currentUser?._id);
  const {
    uploadProfileImage,
    removeProfileImage,
    updateIdentityMark,
    updateProfile,
    updatePrivacySettings,
    isPending: isProfileImagePending,
  } = useProfileImageMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [previewProfileImageUrl, setPreviewProfileImageUrl] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);
  const [profileImageStatus, setProfileImageStatus] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState(() => getProfileDraftForUser(currentUser));
  const [profileTextError, setProfileTextError] = useState<string | null>(null);
  const [profileTextStatus, setProfileTextStatus] = useState<string | null>(null);
  const [privacyActionError, setPrivacyActionError] = useState<string | null>(null);
  const [privacyActionStatus, setPrivacyActionStatus] = useState<string | null>(null);
  const [portabilityActionError, setPortabilityActionError] = useState<string | null>(null);
  const [portabilityActionStatus, setPortabilityActionStatus] = useState<string | null>(null);
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});
  const [appealActionError, setAppealActionError] = useState<string | null>(null);
  const [appealActionStatus, setAppealActionStatus] = useState<string | null>(null);
  const [isIdentityEditorOpen, setIsIdentityEditorOpen] = useState(false);
  const [identityDraft, setIdentityDraft] = useState<IdentityMarkInput>(() => getIdentityDraftForUser(currentUser));
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityStatus, setIdentityStatus] = useState<string | null>(null);
  const [notificationActionError, setNotificationActionError] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [sessionActionStatus, setSessionActionStatus] = useState<string | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<BrowserNotificationPermissionState>(() => getBrowserNotificationPermission());
  const pushSupport = useMemo(() => getPushNotificationSupportStatus(), []);
  const displayName = getUserDisplayName(currentUser);
  const currentProfileImageSrc = useMemo(
    () => resolveProfileImageSrc(currentUser?.profilePic),
    [currentUser?.profilePic]
  );
  const accountUsername = currentUser?.username?.trim() || 'Not set';
  const accountEmail = currentUser?.email?.trim() || 'Not available';
  const activeSessions = activeSessionsQuery.data ?? [];
  const myEnforcements = myEnforcementsQuery.data ?? [];
  const deletionRequest = privacySummaryQuery.data?.deletionRequest ?? null;
  const retentionSummary = deletionRequest?.retentionSummary ?? privacySummaryQuery.data?.retentionSummary ?? null;
  const visibleProfileImageSrc = previewProfileImageUrl ?? currentProfileImageSrc;
  const canRemoveUploadedProfileImage = isUploadedProfileImage(currentUser?.profilePic);
  const identityPreviewMark = {
    ...identityDraft,
    source: 'custom' as const,
  };
  const isBrowserNotificationToggleDisabled =
    !browserNotificationsEnabled &&
    (browserNotificationPermission === 'unsupported' || browserNotificationPermission === 'denied');
  const isServerNotificationToggleDisabled = isLoadingServerPreferences || isSavingServerPreferences;
  const isPushToggleDisabled = isServerNotificationToggleDisabled || (!pushEnabled && !pushSupport.supported);
  const pushSupportMessage = !pushSupport.supported
    ? pushSupport.reason === 'missing_vapid_key'
      ? 'Push delivery is not configured for this environment.'
      : 'Push notifications are not available in this browser.'
    : null;
  const showOnlineStatus = currentUser?.showOnlineStatus !== false;
  const showLastSeen = currentUser?.showLastSeen !== false;
  const showProfileStatus = currentUser?.showProfileStatus !== false;
  const formatSettingsTimestamp = useCallback((value?: string | null) => (
    formatDateTime(value)
  ), [formatDateTime]);

  useEffect(() => {
    if (!selectedProfileImage) {
      setPreviewProfileImageUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedProfileImage);
    setPreviewProfileImageUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedProfileImage]);

  const resetProfileImageSelection = useCallback(() => {
    setSelectedProfileImage(null);
    setProfileImageError(null);
    setProfileImageStatus(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const resetIdentityDraft = useCallback(() => {
    setIdentityDraft(getIdentityDraftForUser(currentUser));
    setIdentityError(null);
    setIdentityStatus(null);
  }, [currentUser]);

  const resetProfileDraft = useCallback(() => {
    setProfileDraft(getProfileDraftForUser(currentUser));
    setProfileTextError(null);
    setProfileTextStatus(null);
    setPrivacyActionError(null);
    setPrivacyActionStatus(null);
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen) {
      resetProfileImageSelection();
      setIsIdentityEditorOpen(false);
      resetIdentityDraft();
      resetProfileDraft();
      setSessionActionError(null);
      setSessionActionStatus(null);
      setAppealDrafts({});
      setAppealActionError(null);
      setAppealActionStatus(null);
    }
  }, [isOpen, resetIdentityDraft, resetProfileDraft, resetProfileImageSelection]);

  useEffect(() => {
    if (isOpen && !isIdentityEditorOpen) {
      setIdentityDraft(getIdentityDraftForUser(currentUser));
    }
  }, [currentUser, isIdentityEditorOpen, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setProfileDraft(getProfileDraftForUser(currentUser));
    }
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setBrowserNotificationPermission(getBrowserNotificationPermission());
    }
  }, [isOpen]);

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled(!soundEnabled);
  }, [setSoundEnabled, soundEnabled]);

  const handleBrowserNotificationsToggle = useCallback(async () => {
    if (browserNotificationsEnabled) {
      setBrowserNotificationsEnabled(false);
      return;
    }

    const currentPermission = getBrowserNotificationPermission();
    setBrowserNotificationPermission(currentPermission);

    if (currentPermission === 'granted') {
      setBrowserNotificationsEnabled(true);
      return;
    }

    if (canRequestBrowserNotificationPermission()) {
      const nextPermission = await requestBrowserNotificationPermission();
      setBrowserNotificationPermission(nextPermission);
      setBrowserNotificationsEnabled(nextPermission === 'granted');
    }
  }, [browserNotificationsEnabled, setBrowserNotificationsEnabled]);

  const handleEmailNotificationsToggle = useCallback(async () => {
    setNotificationActionError(null);

    try {
      await setEmailNotificationsEnabled(!emailNotificationsEnabled);
    } catch {
      setNotificationActionError('Email notification preference could not be saved.');
    }
  }, [emailNotificationsEnabled, setEmailNotificationsEnabled]);

  const handlePushNotificationsToggle = useCallback(async () => {
    setNotificationActionError(null);

    try {
      if (pushEnabled) {
        await setPushNotificationsEnabled(false);
        return;
      }

      const currentPermission = getBrowserNotificationPermission();
      setBrowserNotificationPermission(currentPermission);

      if (currentPermission === 'denied' || currentPermission === 'unsupported') {
        return;
      }

      if (currentPermission !== 'granted' && canRequestBrowserNotificationPermission()) {
        const nextPermission = await requestBrowserNotificationPermission();
        setBrowserNotificationPermission(nextPermission);

        if (nextPermission !== 'granted') {
          return;
        }
      }

      const subscription = await subscribeToChatifyPushNotifications();
      await registerPushSubscription(subscription);
    } catch {
      setNotificationActionError('Push notifications could not be enabled.');
    }
  }, [pushEnabled, registerPushSubscription, setPushNotificationsEnabled]);

  const handleRevokeSession = useCallback(async (sessionId: string) => {
    setSessionActionError(null);
    setSessionActionStatus(null);

    try {
      await revokeSession.mutateAsync(sessionId);
      setSessionActionStatus('Session revoked.');
    } catch {
      setSessionActionError('We could not revoke that session. Try again.');
    }
  }, [revokeSession]);

  const handleRevokeAllSessions = useCallback(async () => {
    setSessionActionError(null);
    setSessionActionStatus(null);

    try {
      await revokeAllSessions.mutateAsync();
      onClose();
    } catch {
      setSessionActionError('We could not log out everywhere. Try again.');
    }
  }, [onClose, revokeAllSessions]);

  const handleProfileImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setProfileImageStatus(null);

    if (!file) {
      setSelectedProfileImage(null);
      return;
    }

    const validationError = validateProfileImageFile(file);

    if (validationError) {
      setSelectedProfileImage(null);
      setProfileImageError(validationError);
      event.target.value = '';
      return;
    }

    setProfileImageError(null);
    setSelectedProfileImage(file);
  }, []);

  const handleSaveProfileImage = useCallback(async () => {
    if (!selectedProfileImage || isProfileImagePending) {
      return;
    }

    setProfileImageError(null);
    setProfileImageStatus(null);

    try {
      await uploadProfileImage.mutateAsync(selectedProfileImage);
      resetProfileImageSelection();
      setProfileImageStatus('Profile picture updated.');
    } catch (error) {
      setProfileImageError(getProfileImageErrorMessage(error, 'We could not update your profile picture. Try again.'));
    }
  }, [isProfileImagePending, resetProfileImageSelection, selectedProfileImage, uploadProfileImage]);

  const handleRemoveProfileImage = useCallback(async () => {
    if (isProfileImagePending) {
      return;
    }

    if (selectedProfileImage) {
      resetProfileImageSelection();
      return;
    }

    if (!canRemoveUploadedProfileImage) {
      setProfileImageStatus(null);
      setProfileImageError('There is no uploaded profile picture to remove.');
      return;
    }

    setProfileImageError(null);
    setProfileImageStatus(null);

    try {
      await removeProfileImage.mutateAsync();
      resetProfileImageSelection();
      setProfileImageStatus('Profile picture removed.');
    } catch (error) {
      setProfileImageError(getProfileImageErrorMessage(error, 'We could not remove your profile picture. Try again.'));
    }
  }, [
    canRemoveUploadedProfileImage,
    isProfileImagePending,
    removeProfileImage,
    resetProfileImageSelection,
    selectedProfileImage,
  ]);

  const updateIdentityDraftField = useCallback(<Key extends keyof IdentityMarkInput>(
    field: Key,
    value: IdentityMarkInput[Key]
  ) => {
    setIdentityDraft((current) => ({
      ...current,
      [field]: field === 'initials' && typeof value === 'string'
        ? value.toLocaleUpperCase().slice(0, 3)
        : value,
    }));
    setIdentityError(null);
    setIdentityStatus(null);
  }, []);

  const handleOpenIdentityEditor = useCallback(() => {
    resetIdentityDraft();
    setIsIdentityEditorOpen(true);
  }, [resetIdentityDraft]);

  const handleCancelIdentityEditor = useCallback(() => {
    resetIdentityDraft();
    setIsIdentityEditorOpen(false);
  }, [resetIdentityDraft]);

  const handleSaveIdentityMark = useCallback(async () => {
    if (updateIdentityMark.isPending) {
      return;
    }

    const nextDraft = {
      ...identityDraft,
      label: identityDraft.label.trim(),
      initials: identityDraft.initials.trim().toLocaleUpperCase(),
    };
    const validationError = validateIdentityDraft(nextDraft);

    if (validationError) {
      setIdentityError(validationError);
      setIdentityStatus(null);
      return;
    }

    try {
      setIdentityError(null);
      setIdentityStatus(null);
      await updateIdentityMark.mutateAsync(nextDraft);
      setIdentityDraft(nextDraft);
      setIdentityStatus('Identity updated');
      setIsIdentityEditorOpen(false);
    } catch (error) {
      setIdentityError(getProfileImageErrorMessage(error, 'We could not update your identity. Try again.'));
    }
  }, [identityDraft, updateIdentityMark]);

  const updateProfileDraftField = useCallback((
    field: 'profileBio' | 'profileStatus',
    value: string
  ) => {
    setProfileDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setProfileTextError(null);
    setProfileTextStatus(null);
  }, []);

  const handleSaveProfileText = useCallback(async () => {
    if (updateProfile.isPending) {
      return;
    }

    const validationError = validateProfileDraft(profileDraft);

    if (validationError) {
      setProfileTextError(validationError);
      setProfileTextStatus(null);
      return;
    }

    const nextDraft = normalizeProfileDraft(profileDraft);

    try {
      setProfileTextError(null);
      setProfileTextStatus(null);
      await updateProfile.mutateAsync(nextDraft);
      setProfileDraft(nextDraft);
      setProfileTextStatus('Profile updated.');
    } catch (error) {
      setProfileTextError(getProfileImageErrorMessage(error, 'We could not update your profile. Try again.'));
    }
  }, [profileDraft, updateProfile]);

  const handlePrivacyToggle = useCallback(async (
    field: 'showOnlineStatus' | 'showLastSeen' | 'showProfileStatus',
    nextValue: boolean
  ) => {
    if (updatePrivacySettings.isPending) {
      return;
    }

    try {
      setPrivacyActionError(null);
      setPrivacyActionStatus(null);
      await updatePrivacySettings.mutateAsync({ [field]: nextValue });
      setPrivacyActionStatus('Privacy settings updated.');
    } catch (error) {
      setPrivacyActionError(getProfileImageErrorMessage(error, 'We could not update privacy settings. Try again.'));
    }
  }, [updatePrivacySettings]);

  const handleExportAccountData = useCallback(async () => {
    if (exportAccountData.isPending) {
      return;
    }

    setPortabilityActionError(null);
    setPortabilityActionStatus(null);

    try {
      const result = await exportAccountData.mutateAsync();
      const filename = buildPrivacyExportFilename();
      downloadJsonFile(filename, result.export);
      setPortabilityActionStatus(`Export ready: ${filename}`);
    } catch (error) {
      setPortabilityActionError(getProfileImageErrorMessage(error, 'We could not prepare your account export. Try again.'));
    }
  }, [exportAccountData]);

  const handleRequestDeletion = useCallback(async () => {
    if (requestAccountDeletion.isPending) {
      return;
    }

    setPortabilityActionError(null);
    setPortabilityActionStatus(null);

    try {
      const result = await requestAccountDeletion.mutateAsync();
      const scheduled = formatSettingsTimestamp(result.deletionRequest.scheduledFor);
      setPortabilityActionStatus(`Deletion request scheduled for ${scheduled}.`);
    } catch (error) {
      setPortabilityActionError(getProfileImageErrorMessage(error, 'We could not create your deletion request. Try again.'));
    }
  }, [formatSettingsTimestamp, requestAccountDeletion]);

  const handleCancelDeletion = useCallback(async () => {
    if (cancelAccountDeletion.isPending) {
      return;
    }

    setPortabilityActionError(null);
    setPortabilityActionStatus(null);

    try {
      await cancelAccountDeletion.mutateAsync();
      setPortabilityActionStatus('Deletion request canceled.');
    } catch (error) {
      setPortabilityActionError(getProfileImageErrorMessage(error, 'We could not cancel your deletion request. Try again.'));
    }
  }, [cancelAccountDeletion]);

  const handleAppealDraftChange = useCallback((reportId: string, value: string) => {
    setAppealDrafts((current) => ({
      ...current,
      [reportId]: value,
    }));
    setAppealActionError(null);
    setAppealActionStatus(null);
  }, []);

  const handleSubmitAppeal = useCallback(async (reportId: string) => {
    if (submitModerationAppeal.isPending) {
      return;
    }

    const reason = appealDrafts[reportId]?.trim() ?? '';

    if (!reason) {
      setAppealActionStatus(null);
      setAppealActionError('Add a short appeal reason before submitting.');
      return;
    }

    setAppealActionError(null);
    setAppealActionStatus(null);

    try {
      await submitModerationAppeal.mutateAsync({
        reportId,
        payload: { reason },
      });
      setAppealDrafts((current) => ({
        ...current,
        [reportId]: '',
      }));
      setAppealActionStatus('Appeal submitted.');
    } catch (error) {
      setAppealActionError(getProfileImageErrorMessage(error, 'We could not submit your appeal. Try again.'));
    }
  }, [appealDrafts, submitModerationAppeal]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 mx-4 flex max-h-[min(92dvh,760px)] w-full max-w-md flex-col rounded-xl border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-[var(--chat-shadow)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--chat-border)] p-4">
          <h2 className="text-lg font-semibold text-[var(--chat-text)]">{t('settings.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--chat-radius-md)] p-1 text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto p-4">
          <section
            aria-labelledby="account-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                <UserRound aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="min-w-0">
                  <h3 id="account-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                    {t('settings.account.title')}
                  </h3>
                  <p className="mt-0.5 truncate text-sm font-medium text-[var(--chat-text)]">
                    {displayName}
                  </p>
                </div>
                <dl className="space-y-2">
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--chat-border)] pt-2">
                    <dt className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--chat-text-muted)]">
                      <AtSign aria-hidden="true" className="h-3.5 w-3.5" />
                      {t('settings.account.username')}
                    </dt>
                    <dd className="min-w-0 truncate text-right text-sm font-medium text-[var(--chat-text)]">
                      {accountUsername}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--chat-border)] pt-2">
                    <dt className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--chat-text-muted)]">
                      <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                      {t('settings.account.email')}
                    </dt>
                    <dd className="min-w-0 truncate text-right text-sm font-medium text-[var(--chat-text)]">
                      {accountEmail}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="language-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                <Languages aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 id="language-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                  {t('settings.language.title')}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                  {t('settings.language.description')}
                </p>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="sr-only">{t('settings.language.title')}</legend>
              {Object.values(supportedLocales).map((option) => (
                <label
                  key={option.code}
                  className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] px-3 py-2 text-sm transition hover:bg-[var(--chat-panel-elevated)]"
                >
                  <span className="font-semibold text-[var(--chat-text)]">
                    {option.code === 'ar' ? t('settings.language.arabic') : t('settings.language.english')}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-medium text-[var(--chat-text-muted)]">
                    {option.nativeName}
                    <input
                      type="radio"
                      name="chatify-language"
                      value={option.code}
                      checked={locale === option.code}
                      onChange={() => setLocale(option.code)}
                      className="h-4 w-4 accent-[var(--chat-accent)]"
                    />
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="mt-3 text-xs text-[var(--chat-text-muted)]">
              {t('settings.language.current', { values: { language: localeMeta.nativeName } })}
            </p>
          </section>

          <section
            aria-labelledby="profile-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                <UserRound aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 id="profile-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                  Profile
                </h3>
                <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                  Bio and status appear on contact-card surfaces. Your email stays private.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="profile-bio-input" className="text-xs font-semibold text-[var(--chat-text-muted)]">
                    Bio
                  </label>
                  <span className="text-xs text-[var(--chat-text-soft)]">
                    {profileDraft.profileBio.length}/{PROFILE_BIO_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="profile-bio-input"
                  value={profileDraft.profileBio}
                  maxLength={PROFILE_BIO_MAX_LENGTH}
                  onChange={(event) => updateProfileDraftField('profileBio', event.target.value)}
                  className="mt-1 min-h-20 w-full resize-none rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  placeholder="Add a short bio"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="profile-status-input" className="text-xs font-semibold text-[var(--chat-text-muted)]">
                    Status
                  </label>
                  <span className="text-xs text-[var(--chat-text-soft)]">
                    {profileDraft.profileStatus.length}/{PROFILE_STATUS_MAX_LENGTH}
                  </span>
                </div>
                <input
                  id="profile-status-input"
                  type="text"
                  value={profileDraft.profileStatus}
                  maxLength={PROFILE_STATUS_MAX_LENGTH}
                  onChange={(event) => updateProfileDraftField('profileStatus', event.target.value)}
                  className="mt-1 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  placeholder="Available, focused, away"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveProfileText}
                  disabled={updateProfile.isPending}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  {updateProfile.isPending && <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
                  Save profile
                </button>
                <button
                  type="button"
                  aria-label="Reset profile fields"
                  onClick={resetProfileDraft}
                  disabled={updateProfile.isPending}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text-muted)] transition hover:bg-[var(--chat-panel-elevated)] hover:text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  Reset
                </button>
              </div>

              <div className="min-h-5">
                {profileTextError ? (
                  <p className="text-xs font-medium text-[var(--chat-danger)]" role="alert">
                    {profileTextError}
                  </p>
                ) : null}
                {profileTextStatus ? (
                  <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                    {profileTextStatus}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-[var(--chat-border)] pt-3">
                <PrivacyToggleRow
                  label="Online status"
                  description="Show contacts when this account is online and call-reachable."
                  pressed={showOnlineStatus}
                  disabled={updatePrivacySettings.isPending}
                  ariaLabel="Toggle online status visibility"
                  onClick={() => handlePrivacyToggle('showOnlineStatus', !showOnlineStatus)}
                />
                <PrivacyToggleRow
                  label="Last seen"
                  description="Show contacts an approximate last-seen time while offline."
                  pressed={showLastSeen}
                  disabled={updatePrivacySettings.isPending}
                  ariaLabel="Toggle last seen visibility"
                  onClick={() => handlePrivacyToggle('showLastSeen', !showLastSeen)}
                />
                <PrivacyToggleRow
                  label="Profile status"
                  description="Show your short status on contact-card surfaces."
                  pressed={showProfileStatus}
                  disabled={updatePrivacySettings.isPending}
                  ariaLabel="Toggle profile status visibility"
                  onClick={() => handlePrivacyToggle('showProfileStatus', !showProfileStatus)}
                />
              </div>

              <div className="min-h-5">
                {privacyActionError ? (
                  <p className="text-xs font-medium text-[var(--chat-warning)]" role="alert">
                    {privacyActionError}
                  </p>
                ) : null}
                {privacyActionStatus ? (
                  <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                    {privacyActionStatus}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="privacy-portability-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                <Download aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 id="privacy-portability-title" className="text-sm font-semibold text-[var(--chat-text)]">
                  {t('settings.privacy.title')}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                  {t('settings.privacy.description')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--chat-text)]">Export account data</p>
                  <p className="mt-1 text-xs text-[var(--chat-text-muted)]">
                    Includes authorized account, conversation, media metadata, reports you filed, and encrypted-message limitations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportAccountData}
                  disabled={exportAccountData.isPending}
                  className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  {exportAccountData.isPending ? (
                    <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                  ) : (
                    <Download aria-hidden="true" className="h-4 w-4" />
                  )}
                  {exportAccountData.isPending ? 'Preparing...' : 'Export data'}
                </button>
              </div>

              <div className="flex flex-col gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--chat-text)]">Account deletion request</p>
                  <p className="mt-1 text-xs text-[var(--chat-text-muted)]">
                    {deletionRequest?.status === 'pending'
                      ? `Scheduled for ${formatSettingsTimestamp(deletionRequest.scheduledFor)}. ${retentionSummary?.moderation ?? 'Some abuse and security records may be retained.'}`
                      : 'Creates a reversible request before account data is anonymized or retained as conversation tombstones.'}
                  </p>
                  {privacySummaryQuery.isLoading ? (
                    <p className="mt-2 text-xs text-[var(--chat-text-soft)]" role="status">Loading deletion status...</p>
                  ) : null}
                  {privacySummaryQuery.isError ? (
                    <p className="mt-2 text-xs font-medium text-[var(--chat-warning)]" role="alert">
                      Privacy status could not be loaded.
                    </p>
                  ) : null}
                </div>
                {deletionRequest?.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={handleCancelDeletion}
                    disabled={cancelAccountDeletion.isPending}
                    className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  >
                    {cancelAccountDeletion.isPending ? (
                      <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                    ) : (
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    )}
                    Cancel request
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestDeletion}
                    disabled={requestAccountDeletion.isPending}
                    className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-danger)]/60 px-3 py-2 text-sm font-semibold text-[var(--chat-danger)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  >
                    {requestAccountDeletion.isPending ? (
                      <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                    ) : (
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    )}
                    Request deletion
                  </button>
                )}
              </div>

              <div className="min-h-5">
                {portabilityActionError ? (
                  <p className="text-xs font-medium text-[var(--chat-danger)]" role="alert">
                    {portabilityActionError}
                  </p>
                ) : null}
                {portabilityActionStatus ? (
                  <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                    {portabilityActionStatus}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="account-safety-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                <Scale aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 id="account-safety-title" className="text-sm font-semibold text-[var(--chat-text)]">
                  {t('settings.accountSafety.title')}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                  {t('settings.accountSafety.description')}
                </p>
              </div>
            </div>

            {myEnforcementsQuery.isLoading ? (
              <p className="text-xs text-[var(--chat-text-muted)]" role="status">
                Loading moderation outcomes...
              </p>
            ) : myEnforcementsQuery.isError ? (
              <p className="text-xs font-medium text-[var(--chat-warning)]" role="alert">
                Moderation outcomes could not be loaded.
              </p>
            ) : myEnforcements.length === 0 ? (
              <p className="text-sm text-[var(--chat-text-muted)]">
                No appealable enforcement outcomes.
              </p>
            ) : (
              <div className="space-y-3">
                {myEnforcements.map((enforcement) => {
                  const actionLabel = getModerationActionLabel(enforcement.moderationAction);
                  const appealReasonId = `appeal-reason-${enforcement._id}`;
                  const appealDraft = appealDrafts[enforcement._id] ?? '';

                  return (
                    <article
                      key={enforcement._id}
                      className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--chat-text)]">{actionLabel}</p>
                          <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                            {getAbuseReasonLabel(enforcement.reason)} - {formatSettingsTimestamp(enforcement.reviewedAt ?? enforcement.createdAt)}
                          </p>
                        </div>
                        <span className="rounded-[var(--chat-radius-sm)] border border-[var(--chat-border)] px-2 py-1 text-xs font-semibold text-[var(--chat-text-muted)]">
                          {enforcement.appeal ? `Appeal ${enforcement.appeal.status}` : enforcement.canAppeal ? 'Appealable' : 'Not appealable'}
                        </span>
                      </div>

                      {enforcement.enforcement?.summary ? (
                        <p className="mt-2 text-xs text-[var(--chat-text-muted)]">
                          {enforcement.enforcement.summary}
                        </p>
                      ) : null}

                      {enforcement.appeal ? (
                        <div className="mt-3 rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] p-3">
                          <p className="text-xs font-semibold text-[var(--chat-text-muted)]">Your appeal</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--chat-text)]">{enforcement.appeal.reason}</p>
                          {enforcement.appeal.reviewerNote ? (
                            <p className="mt-2 text-xs text-[var(--chat-text-muted)]">
                              Reviewer note: {enforcement.appeal.reviewerNote}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {enforcement.canAppeal ? (
                        <div className="mt-3 space-y-2">
                          <label className="block text-xs font-semibold text-[var(--chat-text-muted)]" htmlFor={appealReasonId}>
                            Appeal reason for {actionLabel.toLowerCase()}
                          </label>
                          <textarea
                            id={appealReasonId}
                            value={appealDraft}
                            onChange={(event) => handleAppealDraftChange(enforcement._id, event.target.value)}
                            rows={3}
                            maxLength={1000}
                            className="w-full resize-y rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm leading-6 text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSubmitAppeal(enforcement._id)}
                            disabled={submitModerationAppeal.isPending}
                            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                          >
                            {submitModerationAppeal.isPending ? (
                              <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                            ) : (
                              <Scale aria-hidden="true" className="h-4 w-4" />
                            )}
                            Submit appeal
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-3 min-h-5">
              {appealActionError ? (
                <p className="text-xs font-medium text-[var(--chat-danger)]" role="alert">
                  {appealActionError}
                </p>
              ) : null}
              {appealActionStatus ? (
                <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                  {appealActionStatus}
                </p>
              ) : null}
            </div>
          </section>

          <section
            aria-labelledby="session-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 id="session-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                    {t('settings.security.title')}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                    {t('settings.security.description')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRevokeAllSessions}
                disabled={revokeAllSessions.isPending || activeSessions.length === 0}
                className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-danger)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                {revokeAllSessions.isPending ? (
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                )}
                Log out everywhere
              </button>
            </div>

            <div className="space-y-2">
              {activeSessionsQuery.isLoading ? (
                <p className="text-xs text-[var(--chat-text-muted)]" role="status">
                  Loading active sessions...
                </p>
              ) : null}

              {activeSessionsQuery.isError ? (
                <div className="flex items-center justify-between gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-warning)]/40 bg-[var(--chat-panel)] p-3">
                  <p className="text-xs font-medium text-[var(--chat-warning)]" role="alert">
                    Active sessions could not be loaded.
                  </p>
                  <button
                    type="button"
                    onClick={() => activeSessionsQuery.refetch()}
                    className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  >
                    <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              ) : null}

              {!activeSessionsQuery.isLoading && !activeSessionsQuery.isError && activeSessions.length === 0 ? (
                <p className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3 text-xs text-[var(--chat-text-muted)]">
                  No active sessions.
                </p>
              ) : null}

              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--chat-text)]">
                          {session.deviceLabel || 'Unknown device'}
                        </p>
                        {session.current ? (
                          <span className="rounded-full border border-[var(--chat-accent)]/40 bg-[var(--chat-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--chat-accent)]">
                            Current
                          </span>
                        ) : null}
                        {session.rememberMe ? (
                          <span className="rounded-full border border-[var(--chat-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--chat-text-muted)]">
                            Remembered
                          </span>
                        ) : null}
                      </div>
                      <dl className="mt-2 grid gap-1 text-xs text-[var(--chat-text-muted)]">
                        <div className="flex justify-between gap-3">
                          <dt>Last active</dt>
                          <dd className="text-right">{formatSettingsTimestamp(session.lastUsedAt)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Created</dt>
                          <dd className="text-right">{formatSettingsTimestamp(session.createdAt)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Expires</dt>
                          <dd className="text-right">{formatSettingsTimestamp(session.expiresAt)}</dd>
                        </div>
                      </dl>
                    </div>
                    {session.current ? (
                      <p className="shrink-0 text-right text-xs text-[var(--chat-text-muted)]">
                        Use Logout to end this session.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revokeSession.isPending}
                        className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--chat-danger)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {revokeSession.isPending ? (
                          <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
                        ) : (
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="min-h-5">
                {sessionActionError ? (
                  <p className="text-xs font-medium text-[var(--chat-danger)]" role="alert">
                    {sessionActionError}
                  </p>
                ) : null}
                {sessionActionStatus ? (
                  <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                    {sessionActionStatus}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="profile-picture-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel)]">
                {visibleProfileImageSrc ? (
                  <img
                    src={visibleProfileImageSrc}
                    alt={previewProfileImageUrl ? `Selected profile picture preview for ${displayName}` : `Current profile picture for ${displayName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <IdentityMarkTile
                    user={currentUser}
                    label={displayName}
                    variant="account"
                    className="h-full w-full"
                    aria-label={`${displayName} profile picture fallback`}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h3 id="profile-picture-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                    Profile picture
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                    PNG, JPG, or WebP up to 2 MB.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label
                    htmlFor="profile-picture-input"
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] focus-within:ring-2 focus-within:ring-[var(--chat-focus)]"
                  >
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                    Choose image
                    <input
                      ref={fileInputRef}
                      id="profile-picture-input"
                      name="profileImage"
                      type="file"
                      accept={PROFILE_IMAGE_ACCEPT}
                      className="sr-only"
                      onChange={handleProfileImageChange}
                      aria-describedby="profile-picture-help profile-picture-feedback"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveProfileImage}
                    disabled={!selectedProfileImage || isProfileImagePending}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  >
                    {uploadProfileImage.isPending ? (
                      <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                    ) : (
                      <ImagePlus aria-hidden="true" className="h-4 w-4" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveProfileImage}
                    disabled={isProfileImagePending || (!selectedProfileImage && !canRemoveUploadedProfileImage)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-danger)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  >
                    {removeProfileImage.isPending ? (
                      <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                    ) : (
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    )}
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={resetProfileImageSelection}
                    disabled={!selectedProfileImage && !profileImageError}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-transparent px-3 py-2 text-sm font-semibold text-[var(--chat-text-muted)] transition hover:bg-[var(--chat-panel-elevated)] hover:text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    Reset
                  </button>
                </div>
                <p id="profile-picture-help" className="sr-only">
                  Choose an image file, preview it, then save it as your profile picture.
                </p>
                <div id="profile-picture-feedback" className="min-h-5">
                  {profileImageError ? (
                    <p className="text-xs font-medium text-[var(--chat-danger)]" role="alert">
                      {profileImageError}
                    </p>
                  ) : null}
                  {profileImageStatus ? (
                    <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                      {profileImageStatus}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="identity-mark-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="flex items-start gap-3">
              <IdentityMarkTile
                user={currentUser}
                identityMark={currentUser?.identityMark}
                label={displayName}
                variant="account"
                className="h-16 w-16 rounded-[var(--chat-radius-md)]"
                aria-label={`${displayName} abstract identity mark`}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id="identity-mark-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                      Identity mark
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                      {currentUser?.identityMark?.source === 'custom' ? currentUser.identityMark.label : 'Default abstract mark'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={isIdentityEditorOpen ? handleCancelIdentityEditor : handleOpenIdentityEditor}
                    className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                    aria-expanded={isIdentityEditorOpen}
                    aria-controls="identity-mark-editor"
                  >
                    <Palette aria-hidden="true" className="h-4 w-4" />
                    {isIdentityEditorOpen ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {isIdentityEditorOpen && (
                  <div id="identity-mark-editor" className="space-y-3">
                    <div className="flex items-center gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3">
                      <IdentityMarkTile
                        identityMark={identityPreviewMark}
                        label={identityDraft.label}
                        variant="account"
                        className="h-14 w-14 rounded-[var(--chat-radius-md)]"
                        aria-label={`${identityDraft.label || displayName} preview identity mark`}
                      />
                      <div className="min-w-0 flex-1">
                        <label className="block text-xs font-semibold text-[var(--chat-text-muted)]" htmlFor="identity-label-input">
                          Identity label
                        </label>
                        <input
                          id="identity-label-input"
                          type="text"
                          value={identityDraft.label}
                          maxLength={IDENTITY_LABEL_MAX_LENGTH}
                          onChange={(event) => updateIdentityDraftField('label', event.target.value)}
                          className="mt-1 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <label className="block text-xs font-semibold text-[var(--chat-text-muted)]" htmlFor="identity-initials-input">
                          Initials
                        </label>
                        <input
                          id="identity-initials-input"
                          type="text"
                          value={identityDraft.initials}
                          maxLength={3}
                          onChange={(event) => updateIdentityDraftField('initials', event.target.value)}
                          className="mt-1 w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-center text-sm font-bold text-[var(--chat-text)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                        />
                      </div>
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold text-[var(--chat-text-muted)]">Palette</legend>
                      <div className="flex flex-wrap gap-2">
                        {identityPalettes.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateIdentityDraftField('paletteId', option.id)}
                            className={`inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                              identityDraft.paletteId === option.id
                                ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                                : 'border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-elevated)] hover:text-[var(--chat-text)]'
                            }`}
                            aria-pressed={identityDraft.paletteId === option.id}
                          >
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: option.swatch }}
                              aria-hidden="true"
                            />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold text-[var(--chat-text-muted)]">Pattern</legend>
                      <div className="flex flex-wrap gap-2">
                        {identityPatterns.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateIdentityDraftField('patternId', option.id)}
                            className={`min-h-9 rounded-[var(--chat-radius-md)] border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                              identityDraft.patternId === option.id
                                ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                                : 'border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-elevated)] hover:text-[var(--chat-text)]'
                            }`}
                            aria-pressed={identityDraft.patternId === option.id}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold text-[var(--chat-text-muted)]">Accent</legend>
                      <div className="flex flex-wrap gap-2">
                        {identityAccents.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateIdentityDraftField('accentId', option.id)}
                            className={`inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                              identityDraft.accentId === option.id
                                ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                                : 'border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-elevated)] hover:text-[var(--chat-text)]'
                            }`}
                            aria-pressed={identityDraft.accentId === option.id}
                          >
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: option.swatch }}
                              aria-hidden="true"
                            />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveIdentityMark}
                        disabled={updateIdentityMark.isPending}
                        className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {updateIdentityMark.isPending ? (
                          <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                        ) : (
                          <Palette aria-hidden="true" className="h-4 w-4" />
                        )}
                        Save identity
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelIdentityEditor}
                        disabled={updateIdentityMark.isPending}
                        className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text-muted)] transition hover:bg-[var(--chat-panel-elevated)] hover:text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div id="identity-mark-feedback" className="min-h-5">
                  {identityError ? (
                    <p className="text-xs font-medium text-[var(--chat-danger)]" role="alert">
                      {identityError}
                    </p>
                  ) : null}
                  {identityStatus ? (
                    <p className="text-xs font-medium text-[var(--chat-success)]" role="status">
                      {identityStatus}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="notification-settings-title"
            className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-3"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel)] text-[var(--chat-accent)]">
                <Bell aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 id="notification-settings-title" className="text-sm font-semibold text-[var(--chat-text)]">
                  {t('settings.notifications.title')}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--chat-text-muted)]">
                  Alerts use generic copy. Muted conversations still update unread counts and receipts.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-[var(--chat-text)]">
                    <Volume2 aria-hidden="true" className="h-4 w-4" />
                    {t('settings.notifications.sound')}
                  </p>
                  <p className="text-xs text-[var(--chat-text-muted)]">Play a local sound for eligible alerts and call tones.</p>
                </div>
                <ToggleButton
                  pressed={soundEnabled}
                  onClick={handleSoundToggle}
                  ariaLabel="Toggle sound notifications"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-[var(--chat-text)]">
                    {browserNotificationsEnabled ? (
                      <Bell aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <BellOff aria-hidden="true" className="h-4 w-4" />
                    )}
                    {t('settings.notifications.browser')}
                  </p>
                  <p className="text-xs text-[var(--chat-text-muted)]">
                    Permission: {getPermissionStatusLabel(browserNotificationPermission)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBrowserNotificationsToggle}
                  disabled={isBrowserNotificationToggleDisabled}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  aria-pressed={browserNotificationsEnabled}
                >
                  {browserNotificationsEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>

              {browserNotificationPermission === 'denied' && (
                <p className="text-xs font-medium text-[var(--chat-warning)]">
                  Browser alerts are blocked in site permissions.
                </p>
              )}
              {browserNotificationPermission === 'unsupported' && (
                <p className="text-xs font-medium text-[var(--chat-text-muted)]">
                  Browser alerts are not available in this environment.
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-[var(--chat-text)]">
                    <Bell aria-hidden="true" className="h-4 w-4" />
                    {t('settings.notifications.push')}
                  </p>
                  <p className="text-xs text-[var(--chat-text-muted)]">
                    Generic external alerts for new messages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushNotificationsToggle}
                  disabled={isPushToggleDisabled}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  aria-pressed={pushEnabled}
                >
                  {pushEnabled ? 'Disable push' : 'Enable push'}
                </button>
              </div>

              {pushSupportMessage && (
                <p className="text-xs font-medium text-[var(--chat-text-muted)]">
                  {pushSupportMessage}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-[var(--chat-text)]">
                    <Mail aria-hidden="true" className="h-4 w-4" />
                    {t('settings.notifications.email')}
                  </p>
                  <p className="text-xs text-[var(--chat-text-muted)]">
                    Sends generic message alerts to your account email.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEmailNotificationsToggle}
                  disabled={isServerNotificationToggleDisabled}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text)] transition hover:bg-[var(--chat-panel-elevated)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  aria-pressed={emailNotificationsEnabled}
                >
                  {emailNotificationsEnabled ? 'Disable email' : 'Enable email'}
                </button>
              </div>

              {isLoadingServerPreferences && (
                <p className="text-xs text-[var(--chat-text-muted)]" role="status">
                  Loading notification preferences...
                </p>
              )}
              {(serverPreferenceError || notificationActionError) && (
                <p className="text-xs font-medium text-[var(--chat-warning)]" role="alert">
                  {notificationActionError ?? serverPreferenceError}
                </p>
              )}
              <p className="text-xs text-[var(--chat-text-muted)]">
                Muted conversations: {mutedChatIds.length}
                {pushSubscriptionCount > 0 ? ` - Push devices: ${pushSubscriptionCount}` : ''}
              </p>
            </div>
          </section>

          {/* Enter to Send */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--chat-text)]">Enter to Send</p>
              <p className="text-xs text-[var(--chat-text-muted)]">Press Enter to send messages</p>
            </div>
            <button
              type="button"
              onClick={() => setEnterToSend(!enterToSend)}
              className={`cursor-pointer relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                enterToSend ? 'bg-[var(--chat-accent)]' : 'bg-[var(--chat-panel-subtle)]'
              }`}
              aria-label="Toggle Enter to Send"
              aria-pressed={enterToSend}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  enterToSend ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {onChatThemePreferenceChange && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--chat-text)]">Chat theme</legend>
              <div
                className="grid grid-cols-3 gap-1 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-1"
                aria-label={`Chat theme preference. Current theme ${chatTheme}.`}
              >
                {themeOptions.map((option) => {
                  const isSelected = chatThemePreference === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChatThemePreferenceChange(option.value)}
                      className={`min-h-9 rounded-[var(--chat-radius-sm)] px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                        isSelected
                          ? 'bg-[var(--chat-panel-elevated)] text-[var(--chat-accent)] shadow-sm'
                          : 'text-[var(--chat-text-muted)] hover:text-[var(--chat-text)]'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {isChatThemeForced && (
                <p className="text-xs text-[var(--chat-warning)]">
                  Theme is forced for visual verification.
                </p>
              )}
            </fieldset>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--chat-border)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer w-full rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 py-2 font-semibold text-[var(--chat-own-text)] transition-colors hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const ToggleButton = ({
  pressed,
  ariaLabel,
  onClick,
  disabled = false,
}: {
  pressed: boolean;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
      pressed ? 'bg-[var(--chat-accent)]' : 'bg-[var(--chat-panel)]'
    } disabled:cursor-not-allowed disabled:opacity-50`}
    aria-label={ariaLabel}
    aria-pressed={pressed}
  >
    <span
      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
        pressed ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const PrivacyToggleRow = ({
  label,
  description,
  pressed,
  disabled,
  ariaLabel,
  onClick,
}: {
  label: string;
  description: string;
  pressed: boolean;
  disabled: boolean;
  ariaLabel: string;
  onClick: () => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--chat-text)]">{label}</p>
      <p className="text-xs text-[var(--chat-text-muted)]">{description}</p>
    </div>
    <ToggleButton
      pressed={pressed}
      disabled={disabled}
      ariaLabel={ariaLabel}
      onClick={onClick}
    />
  </div>
);

export default SettingsModal;
