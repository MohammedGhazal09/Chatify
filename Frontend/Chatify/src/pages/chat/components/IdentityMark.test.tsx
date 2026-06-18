import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeUser } from '../../../test/chatFixtures';
import IdentityMark from './IdentityMark';

describe('IdentityMark', () => {
  it('renders persisted custom identity metadata through the shared abstract renderer', () => {
    render(
      <IdentityMark
        user={makeUser({
          identityMark: {
            source: 'custom',
            label: 'Relay Grid',
            initials: 'RG',
            paletteId: 'teal',
            patternId: 'rings',
            accentId: 'mint',
            updatedAt: '2026-06-17T05:00:00.000Z',
          },
        })}
      />
    );

    expect(screen.getByRole('img', { name: 'Relay Grid abstract identity mark' })).toHaveClass(
      'abstract-identity-tile--pattern-rings'
    );
    expect(screen.getByText('RG')).toBeInTheDocument();
  });

  it('uses user display data when identity metadata is absent', () => {
    render(<IdentityMark user={makeUser({ identityMark: undefined })} />);

    expect(screen.getByRole('img', { name: 'Ada Lovelace abstract identity mark' })).toBeInTheDocument();
  });
});
