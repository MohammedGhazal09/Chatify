import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import { useAuthRedirect } from './useAuthRedirect';

const RedirectHarness = () => {
  useAuthRedirect();
  return <div>Login harness</div>;
};

const renderRedirect = (fromPath: unknown) => render(
  <MemoryRouter initialEntries={[{
    pathname: '/login',
    state: { from: { pathname: fromPath } },
  }]}>
    <Routes>
      <Route path="/login" element={<RedirectHarness />} />
      <Route path="/" element={<div>Safe home</div>} />
      <Route path="/admin" element={<div>Safe admin</div>} />
      <Route path="*" element={<div>Unexpected destination</div>} />
    </Routes>
  </MemoryRouter>
);

describe('useAuthRedirect browser navigation safety', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: makeUser({ username: 'redirect.user' }),
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('preserves valid local destinations after authentication', async () => {
    renderRedirect('/admin');

    expect(await screen.findByText('Safe admin')).toBeInTheDocument();
  });

  it('falls back to home for external, protocol-relative, malformed, or auth-loop destinations', async () => {
    for (const destination of [
      'https://attacker.example/steal',
      '//attacker.example/steal',
      '\\attacker.example\\steal',
      'javascript:alert(1)',
      '/login',
      '/signup',
      '/forgot-password',
      null,
    ]) {
      const rendered = renderRedirect(destination);
      expect(await screen.findByText('Safe home')).toBeInTheDocument();
      rendered.unmount();
    }
  });
});
