import type { IdentityMark as IdentityMarkValue } from '../../../types/auth';
import type { AbstractIdentityTileVariant } from './AbstractIdentityTile';
import AbstractIdentityTile from './AbstractIdentityTile';

interface IdentityMarkUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  identityMark?: IdentityMarkValue;
}

interface IdentityMarkProps {
  user?: IdentityMarkUser | null;
  identityMark?: IdentityMarkValue | null;
  label?: string;
  variant?: AbstractIdentityTileVariant;
  className?: string;
  'aria-label'?: string;
}

const getIdentityLabel = (
  user?: IdentityMarkProps['user'],
  identityMark?: IdentityMarkValue | null,
  label?: string
) => {
  const displayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  return identityMark?.label || label || displayName || user?.email || 'Chatify identity';
};

const IdentityMark = ({
  user,
  identityMark,
  label,
  variant = 'conversation',
  className = '',
  'aria-label': ariaLabel,
}: IdentityMarkProps) => {
  const resolvedIdentityMark = identityMark ?? user?.identityMark ?? null;
  const displayLabel = getIdentityLabel(user, resolvedIdentityMark, label);

  return (
    <AbstractIdentityTile
      id={user?._id ?? displayLabel}
      label={displayLabel}
      identityMark={resolvedIdentityMark}
      variant={variant}
      className={className}
      aria-label={ariaLabel ?? `${displayLabel} abstract identity mark`}
    />
  );
};

export default IdentityMark;
