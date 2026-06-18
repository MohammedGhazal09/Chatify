import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingSpinner from './loadingSpinner';

describe('LoadingSpinner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show the cold-start notice immediately', () => {
    render(<LoadingSpinner />);

    expect(screen.getByRole('heading', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Chatify is starting up')).not.toBeInTheDocument();
  });

  it('shows the cold-start notice after the configured delay', () => {
    render(<LoadingSpinner />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Chatify is starting up');
    expect(notice).toHaveTextContent('Your connection is not the issue');
  });

  it('keeps the cold-start notice hidden when disabled', () => {
    render(<LoadingSpinner showColdStartNotice={false} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.queryByText('Chatify is starting up')).not.toBeInTheDocument();
  });
});
