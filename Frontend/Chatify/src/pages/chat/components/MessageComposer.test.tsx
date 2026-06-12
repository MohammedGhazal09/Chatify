import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEventHandler } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MessageComposer from './MessageComposer';

interface ComposerHarnessProps {
  onSend: () => void;
  sendDisabledReason?: string | null;
  isSendError?: boolean;
}

const ComposerHarness = ({ onSend, sendDisabledReason = null, isSendError = false }: ComposerHarnessProps) => {
  const [value, setValue] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <MessageComposer
      value={value}
      replyingTo={null}
      showEmojiPicker={false}
      isSending={false}
      isSendError={isSendError}
      sendDisabledReason={sendDisabledReason}
      emojiPickerRef={emojiPickerRef}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSend={onSend}
      onToggleEmojiPicker={vi.fn()}
      onAppendEmoji={(emoji) => setValue((currentValue) => `${currentValue}${emoji}`)}
      onCancelReply={vi.fn()}
    />
  );
};

describe('MessageComposer', () => {
  it('sends on Enter when text is present', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ComposerHarness onSend={onSend} />);

    await user.type(screen.getByRole('textbox', { name: 'Write a private message' }), 'Hello');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('keeps a newline on Shift+Enter without sending', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ComposerHarness onSend={onSend} />);

    const textbox = screen.getByRole('textbox', { name: 'Write a private message' });
    await user.type(textbox, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}there');

    expect(onSend).not.toHaveBeenCalled();
    expect(textbox).toHaveValue('Hello\nthere');
  });

  it('renders the secure private-message dock without keyboard helper copy', () => {
    render(<ComposerHarness onSend={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Attach file unavailable in this phase' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Voice message unavailable in this phase' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('Authenticated private session')).toBeInTheDocument();
    expect(screen.queryByText('Press Enter to send')).not.toBeInTheDocument();
  });

  it('keeps exactly 1000 characters sendable and blocks longer messages', async () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const textbox = screen.getByRole('textbox', { name: 'Write a private message' });
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.change(textbox, { target: { value: 'x'.repeat(1000) } });

    expect(sendButton).toBeEnabled();

    fireEvent.change(textbox, { target: { value: 'x'.repeat(1001) } });

    expect(sendButton).toBeDisabled();
    expect(screen.getByText('Message exceeds maximum length of 1000 characters.')).toBeInTheDocument();
  });

  it('shows offline, session, and send error states without enabling send', () => {
    const { rerender } = render(
      <ComposerHarness
        onSend={vi.fn()}
        sendDisabledReason="You are offline. Reconnect to send new messages."
        isSendError
      />
    );

    expect(screen.getByRole('textbox', { name: 'Write a private message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('You are offline. Reconnect to send new messages.')).toBeInTheDocument();
    expect(screen.getByText('We could not send your message. Please try again.')).toBeInTheDocument();

    rerender(
      <ComposerHarness
        onSend={vi.fn()}
        sendDisabledReason="Your session expired. Sign in again to continue."
      />
    );

    expect(screen.getByText('Your session expired. Sign in again to continue.')).toBeInTheDocument();
  });
});
