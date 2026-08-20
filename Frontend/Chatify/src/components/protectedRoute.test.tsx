import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './protectedRoute';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';

const renderProtectedRoute = (initialPath = '/') => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="/" element={<ProtectedRoute><div>Chat view</div></ProtectedRoute>} />
      <Route path="/setup-username" element={<ProtectedRoute requireUsername={false}><div>Setup username</div></ProtectedRoute>} />
      <Route path="/login" element={<div>Login view</div>} />
    </Routes>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('redirects unauthenticated users to login', () => {
    renderProtectedRoute();

    expect(screen.getByText('Login view')).toBeInTheDocument();
  });

  it('redirects authenticated users without username to setup', () => {
    useAuthStore.setState({
      user: makeUser({ username: undefined }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderProtectedRoute();

    expect(screen.getByText('Setup username')).toBeInTheDocument();
  });

  it('renders protected content for authenticated users with username', () => {
    useAuthStore.setState({
      user: makeUser({ username: 'ada.lovelace' }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderProtectedRoute();

    expect(screen.getByText('Chat view')).toBeInTheDocument();
  });

  it('allows username-less authenticated users to reach setup route', () => {
    useAuthStore.setState({
      user: makeUser({ username: undefined }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderProtectedRoute('/setup-username');

    expect(screen.getByText('Setup username')).toBeInTheDocument();
  });
});
