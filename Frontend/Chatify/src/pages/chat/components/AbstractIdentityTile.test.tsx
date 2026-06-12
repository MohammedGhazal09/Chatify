import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AbstractIdentityTile from './AbstractIdentityTile';

describe('AbstractIdentityTile', () => {
  it('renders a deterministic abstract identity mark without an image', () => {
    render(<AbstractIdentityTile id="IN-8B21" label="IN-8B21" />);

    expect(screen.getByRole('img', { name: 'IN-8B21 abstract identity' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /profile/i })).not.toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  it('supports large and media variants for the context rail', () => {
    render(
      <>
        <AbstractIdentityTile id="large" label="Cipher Node" variant="large" />
        <AbstractIdentityTile id="media" label="Shared media" variant="media" />
      </>
    );

    expect(screen.getAllByTestId('abstract-identity-tile')).toHaveLength(2);
  });
});
