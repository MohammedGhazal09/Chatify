import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MessageStatus from './MessageStatus';

describe('MessageStatus', () => {
  it('uses Phase 04 semantic colors for own message receipt states', () => {
    const { rerender } = render(<MessageStatus status="sent" isOwnMessage />);
    expect(screen.getByRole('img', { name: 'Message sent' }).querySelector('svg')).toHaveClass('text-[#6F7B77]');

    rerender(<MessageStatus status="delivered" isOwnMessage />);
    expect(screen.getByRole('img', { name: 'Message delivered' }).querySelector('svg')).toHaveClass('text-[#22C55E]');

    rerender(<MessageStatus status="read" isOwnMessage />);
    expect(screen.getByRole('img', { name: 'Message read' }).querySelector('svg')).toHaveClass('text-[#38BDF8]');
  });
});
