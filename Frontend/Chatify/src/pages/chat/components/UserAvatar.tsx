import { useEffect, useState } from 'react';
import { resolveApiBaseUrl } from '../../../api/apiOrigin';
import type { AbstractIdentityTileVariant } from './AbstractIdentityTile';
import AbstractIdentityTile from './AbstractIdentityTile';

export interface UserAvatarIdentity {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profilePic?: string | null;
}

export type UserAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface UserAvatarProps {
  user?: UserAvatarIdentity | null;
  label?: string;
  variant?: AbstractIdentityTileVariant;
  size?: UserAvatarSize;
  className?: string;
  imageAlt?: string;
  fallbackAriaLabel?: string;
}

const sizeClasses: Record<UserAvatarSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-12 w-12 md:h-14 md:w-14',
  xl: 'h-20 w-20',
};

const getUserAvatarLabel = (user?: UserAvatarIdentity | null, fallback = 'Chatify user') => {
  const displayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  return displayName || user?.email || fallback;
};

const resolveAvatarImageSrc = (src?: string | null) => {
  const trimmed = src?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(blob:|data:|https?:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `${resolveApiBaseUrl()}${trimmed}`;
  }

  return trimmed;
};

const UserAvatar = ({
  user,
  label,
  variant = 'conversation',
  size = 'md',
  className = '',
  imageAlt,
  fallbackAriaLabel,
}: UserAvatarProps) => {
  const displayLabel = label || getUserAvatarLabel(user);
  const imageSrc = resolveAvatarImageSrc(user?.profilePic);
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const shouldShowImage = Boolean(imageSrc && failedImageSrc !== imageSrc);

  useEffect(() => {
    setFailedImageSrc(null);
  }, [imageSrc]);

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-[var(--chat-panel-subtle)] ${sizeClasses[size]} ${className}`}
      data-testid="user-avatar"
    >
      {shouldShowImage && imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt ?? `${displayLabel} profile picture`}
          className="h-full w-full object-cover"
          onError={() => setFailedImageSrc(imageSrc)}
        />
      ) : (
        <AbstractIdentityTile
          id={user?._id}
          label={displayLabel}
          variant={variant}
          className="h-full w-full"
          aria-label={fallbackAriaLabel ?? `${displayLabel} profile picture fallback`}
        />
      )}
    </span>
  );
};

export default UserAvatar;
