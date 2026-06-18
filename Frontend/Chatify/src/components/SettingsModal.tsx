import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Bell, BellOff, ImagePlus, LoaderCircle, Palette, RotateCcw, Trash2, Volume2 } from 'lucide-react';
import { resolveApiBaseUrl } from '../api/apiOrigin';
import { useProfileImageMutation } from '../hooks/useProfileImageMutation';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import IdentityMarkTile from '../pages/chat/components/IdentityMark';
import { useAuthStore } from '../store/authstore';
import {
  canRequestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../utils/notificationPrivacy';
import useLocalStorage from '../hooks/useLocalStorage';
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

const SettingsModal = ({
  isOpen,
  onClose,
  chatTheme = 'dark',
  chatThemePreference = 'system',
  isChatThemeForced = false,
  onChatThemePreferenceChange,
}: SettingsModalProps) => {
  const [enterToSend, setEnterToSend] = useLocalStorage('chatify_enter_to_send', true);
  const currentUser = useAuthStore((state) => state.user);
  const {
    soundEnabled,
    browserNotificationsEnabled,
    mutedChatIds,
    setSoundEnabled,
    setBrowserNotificationsEnabled,
  } = useNotificationPreferences(currentUser?._id);
  const {
    uploadProfileImage,
    removeProfileImage,
    updateIdentityMark,
    isPending: isProfileImagePending,
  } = useProfileImageMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [previewProfileImageUrl, setPreviewProfileImageUrl] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);
  const [profileImageStatus, setProfileImageStatus] = useState<string | null>(null);
  const [isIdentityEditorOpen, setIsIdentityEditorOpen] = useState(false);
  const [identityDraft, setIdentityDraft] = useState<IdentityMarkInput>(() => getIdentityDraftForUser(currentUser));
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityStatus, setIdentityStatus] = useState<string | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<BrowserNotificationPermissionState>(() => getBrowserNotificationPermission());
  const displayName = getUserDisplayName(currentUser);
  const currentProfileImageSrc = useMemo(
    () => resolveProfileImageSrc(currentUser?.profilePic),
    [currentUser?.profilePic]
  );
  const visibleProfileImageSrc = previewProfileImageUrl ?? currentProfileImageSrc;
  const canRemoveUploadedProfileImage = isUploadedProfileImage(currentUser?.profilePic);
  const identityPreviewMark = {
    ...identityDraft,
    source: 'custom' as const,
  };
  const isBrowserNotificationToggleDisabled =
    !browserNotificationsEnabled &&
    (browserNotificationPermission === 'unsupported' || browserNotificationPermission === 'denied');

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

  useEffect(() => {
    if (!isOpen) {
      resetProfileImageSelection();
      setIsIdentityEditorOpen(false);
      resetIdentityDraft();
    }
  }, [isOpen, resetIdentityDraft, resetProfileImageSelection]);

  useEffect(() => {
    if (isOpen && !isIdentityEditorOpen) {
      setIdentityDraft(getIdentityDraftForUser(currentUser));
    }
  }, [currentUser, isIdentityEditorOpen, isOpen]);

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
          <h2 className="text-lg font-semibold text-[var(--chat-text)]">Settings</h2>
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
                  Notifications
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
                    Sound
                  </p>
                  <p className="text-xs text-[var(--chat-text-muted)]">Play a local sound for eligible alerts.</p>
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
                    Browser alerts
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
              <p className="text-xs text-[var(--chat-text-muted)]">
                Muted conversations: {mutedChatIds.length}
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
}: {
  pressed: boolean;
  ariaLabel: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
      pressed ? 'bg-[var(--chat-accent)]' : 'bg-[var(--chat-panel)]'
    }`}
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

export default SettingsModal;
