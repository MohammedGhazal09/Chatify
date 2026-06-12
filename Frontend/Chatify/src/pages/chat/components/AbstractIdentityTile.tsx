import type { CSSProperties } from 'react';

export type AbstractIdentityTileVariant = 'brand' | 'account' | 'conversation' | 'large' | 'media' | 'file';

interface AbstractIdentityTileProps {
  id?: string;
  label?: string;
  variant?: AbstractIdentityTileVariant;
  className?: string;
  'aria-label'?: string;
}

const palettes = [
  ['#0F766E', '#2CB7A7', '#E4F4F1'],
  ['#164E63', '#38BDF8', '#E0F2FE'],
  ['#334155', '#94A3B8', '#F1F5F9'],
  ['#365314', '#84CC16', '#ECFCCB'],
  ['#3F3F46', '#A1A1AA', '#F4F4F5'],
];

const hashText = (value: string) => (
  value.split('').reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0)
);

const getInitials = (label: string) => label
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word.charAt(0).toUpperCase())
  .join('');

const AbstractIdentityTile = ({
  id,
  label = 'Chatify identity',
  variant = 'conversation',
  className = '',
  'aria-label': ariaLabel,
}: AbstractIdentityTileProps) => {
  const seed = id || label || variant;
  const hash = Math.abs(hashText(seed));
  const palette = palettes[hash % palettes.length];
  const showInitials = variant === 'account' || variant === 'conversation';
  const initials = getInitials(label);
  const style = {
    '--tile-base': palette[0],
    '--tile-line': palette[1],
    '--tile-soft': palette[2],
  } as CSSProperties;

  return (
    <span
      className={`abstract-identity-tile abstract-identity-tile--${variant} ${className}`}
      data-testid="abstract-identity-tile"
      role="img"
      aria-label={ariaLabel ?? `${label} abstract identity`}
      style={style}
    >
      <span className="abstract-identity-tile__grid" aria-hidden="true" />
      <span className="abstract-identity-tile__diamond abstract-identity-tile__diamond--outer" aria-hidden="true" />
      <span className="abstract-identity-tile__diamond abstract-identity-tile__diamond--inner" aria-hidden="true" />
      {showInitials && initials && (
        <span className="abstract-identity-tile__initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
};

export default AbstractIdentityTile;
