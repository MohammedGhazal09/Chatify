import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEventHandler } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MessageComposer from './MessageComposer';

interface ComposerHarnessProps {
  onSend: () => void;
}

const ComposerHarness = ({ onSend }: ComposerHarnessProps) => {
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
      isSendError={false}
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

    expect(screen.getByRole('button', { name: 'Attach file unavailable in this phase' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Voice message unavailable in this phase' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('Secure session active')).toBeInTheDocument();
    expect(screen.queryByText('Press Enter to send')).not.toBeInTheDocument();
  });
});
