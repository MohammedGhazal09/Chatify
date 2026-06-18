import type { CSSProperties } from 'react';
import type { IdentityMark } from '../../../types/auth';

export type AbstractIdentityTileVariant = 'brand' | 'account' | 'conversation' | 'large' | 'media' | 'file';

interface AbstractIdentityTileProps {
  id?: string;
  label?: string;
  identityMark?: IdentityMark | null;
  variant?: AbstractIdentityTileVariant;
  className?: string;
  'aria-label'?: string;
}

const palettes = {
  teal: ['#0F766E', '#2CB7A7', '#E4F4F1'],
  indigo: ['#4338CA', '#818CF8', '#EEF2FF'],
  amber: ['#92400E', '#F59E0B', '#FEF3C7'],
  slate: ['#334155', '#94A3B8', '#F1F5F9'],
  rose: ['#9F1239', '#FB7185', '#FFE4E6'],
} satisfies Record<string, [string, string, string]>;

const paletteFallbacks = Object.values(palettes);

const accents = {
  mint: '#5EEAD4',
  sky: '#7DD3FC',
  gold: '#FBBF24',
  coral: '#FB7185',
  graphite: '#CBD5E1',
} satisfies Record<string, string>;

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
  identityMark,
  variant = 'conversation',
  className = '',
  'aria-label': ariaLabel,
}: AbstractIdentityTileProps) => {
  const seed = id || label || variant;
  const hash = Math.abs(hashText(seed));
  const palette = identityMark?.paletteId && palettes[identityMark.paletteId]
    ? palettes[identityMark.paletteId]
    : paletteFallbacks[hash % paletteFallbacks.length];
  const showInitials = variant === 'account' || variant === 'conversation';
  const initials = identityMark?.initials || getInitials(label);
  const pattern = identityMark?.patternId ?? 'grid';
  const style = {
    '--tile-base': palette[0],
    '--tile-line': palette[1],
    '--tile-soft': palette[2],
    '--tile-accent': identityMark?.accentId ? accents[identityMark.accentId] : palette[1],
  } as CSSProperties;

  return (
    <span
      className={`abstract-identity-tile abstract-identity-tile--${variant} abstract-identity-tile--pattern-${pattern} ${className}`}
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
