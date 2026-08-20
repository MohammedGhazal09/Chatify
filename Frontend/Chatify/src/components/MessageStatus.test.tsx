import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MessageStatus from './MessageStatus';

describe('MessageStatus', () => {
  it('uses Phase 06 inherited receipt emphasis for own message states', () => {
    const { rerender } = render(<MessageStatus status="sent" isOwnMessage />);
    expect(screen.getByRole('img', { name: 'Message sent' }).querySelector('svg')).toHaveClass('text-current opacity-65');

    rerender(<MessageStatus status="delivered" isOwnMessage />);
    expect(screen.getByRole('img', { name: 'Message delivered' }).querySelector('svg')).toHaveClass('text-current opacity-85');

    rerender(<MessageStatus status="read" isOwnMessage />);
    expect(screen.getByRole('img', { name: 'Message read' }).querySelector('svg')).toHaveClass('text-current opacity-100');
  });
});
