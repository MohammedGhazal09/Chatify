import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEventHandler } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageUploadState } from '../../../hooks/useChatQueries';
import type { UseVoiceRecorderResult } from '../../../hooks/useVoiceRecorder';
import type { ComposerSendPayload } from '../../../types/chat';

const defaultVoiceRecorder = (): UseVoiceRecorderResult => ({
  status: 'idle',
  isSupported: true,
  isRecording: false,
  canRecord: true,
  draft: null,
  durationSeconds: 0,
  errorMessage: null,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelRecording: vi.fn(),
  clearDraft: vi.fn(),
});

const voiceRecorderMock = vi.hoisted(() => ({
  current: null as UseVoiceRecorderResult | null,
}));

vi.mock('./LazyEmojiPicker', () => ({
  default: ({ height, onEmojiClick, width }: { height: number; onEmojiClick: (emoji: { emoji: string }) => void; width: number }) => (
    <button type="button" data-height={height} data-testid="mock-emoji-picker" data-width={width} onClick={() => onEmojiClick({ emoji: ':)' })}>
      Emoji picker
    </button>
  ),
}));

vi.mock('../../../hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: () => voiceRecorderMock.current,
}));

import MessageComposer from './MessageComposer';

interface ComposerHarnessProps {
  onSend: (payload: ComposerSendPayload) => void;
  sendDisabledReason?: string | null;
  isSendError?: boolean;
  showEmojiPicker?: boolean;
  uploadState?: MessageUploadState;
  onCancelUpload?: () => void;
}

const ComposerHarness = ({
  onSend,
  sendDisabledReason = null,
  isSendError = false,
  showEmojiPicker = false,
  uploadState,
  onCancelUpload,
}: ComposerHarnessProps) => {
  const [value, setValue] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const handleKeyDown = (event: Parameters<KeyboardEventHandler<HTMLTextAreaElement>>[0], payload: ComposerSendPayload) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend(payload);
    }
  };

  return (
    <MessageComposer
      value={value}
      replyingTo={null}
      showEmojiPicker={showEmojiPicker}
      isSending={false}
      isSendError={isSendError}
      sendDisabledReason={sendDisabledReason}
      uploadState={uploadState}
      emojiPickerRef={emojiPickerRef}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSend={onSend}
      onToggleEmojiPicker={vi.fn()}
      onAppendEmoji={(emoji) => setValue((currentValue) => `${currentValue}${emoji}`)}
      onCancelReply={vi.fn()}
      onCancelUpload={onCancelUpload}
    />
  );
};

describe('MessageComposer', () => {
  beforeEach(() => {
    voiceRecorderMock.current = defaultVoiceRecorder();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:attachment-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('keeps the message text vertically centered in the composer input', () => {
    render(<ComposerHarness onSend={vi.fn()} />);

    const textbox = screen.getByRole('textbox', { name: 'Write a private message' });

    expect(textbox).toHaveAttribute('rows', '1');
    expect(textbox).toHaveClass('block', 'px-4', 'py-3.5', 'leading-5');
  });

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

    expect(screen.getByRole('button', { name: 'Attach file' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Record voice message' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('Authenticated private session')).toBeInTheDocument();
    expect(screen.queryByText('Press Enter to send')).not.toBeInTheDocument();
  });

  it('disables recording when the browser cannot provide MediaRecorder support', () => {
    voiceRecorderMock.current = {
      ...defaultVoiceRecorder(),
      status: 'unsupported',
      isSupported: false,
      canRecord: false,
    };

    render(<ComposerHarness onSend={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Record voice message' })).toBeDisabled();
  });

  it('starts voice recording from the composer action', async () => {
    const user = userEvent.setup();
    const startRecording = vi.fn().mockResolvedValue(undefined);
    voiceRecorderMock.current = {
      ...defaultVoiceRecorder(),
      startRecording,
    };

    render(<ComposerHarness onSend={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Record voice message' }));

    expect(startRecording).toHaveBeenCalledTimes(1);
  });

  it('stacks the emoji picker above the composer instead of clipping it inside the dock', () => {
    const { container } = render(<ComposerHarness onSend={vi.fn()} showEmojiPicker />);

    const composerDock = container.querySelector('.composer-dock');
    expect(composerDock).toHaveClass('relative', 'z-20', 'overflow-visible');
    expect(composerDock).not.toHaveClass('overflow-hidden');

    const pickerLayer = screen.getByTestId('composer-emoji-picker-layer');
    expect(pickerLayer).toHaveClass('absolute', 'bottom-full', 'right-0', 'z-[70]', 'mb-3');
    expect(screen.getByTestId('mock-emoji-picker')).toHaveAttribute('data-width', '300');
    expect(screen.getByTestId('mock-emoji-picker')).toHaveAttribute('data-height', '400');
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
        sendDisabledReason="You are offline. New messages will wait until the connection returns."
        isSendError
      />
    );

    expect(screen.getByRole('textbox', { name: 'Write a private message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('You are offline. New messages will wait until the connection returns.');
    expect(screen.getByRole('alert')).toHaveTextContent('Message was not sent. Retry from the failed message or send again when the connection is stable.');

    rerender(
      <ComposerHarness
        onSend={vi.fn()}
        sendDisabledReason="Your session expired. Sign in again to continue."
      />
    );

    expect(screen.getByText('Your session expired. Sign in again to continue.')).toBeInTheDocument();
  });

  it('keeps upload progress and failure actions accessible', async () => {
    const user = userEvent.setup();
    const onCancelUpload = vi.fn();
    const { rerender } = render(
      <ComposerHarness
        onSend={vi.fn()}
        onCancelUpload={onCancelUpload}
        uploadState={{
          clientMessageId: 'client-message-1',
          status: 'uploading',
          progress: 47,
        }}
      />
    );

    const file = new File(['hello'], 'message-states-spec.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(screen.getByText('Uploading 47%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }));
    expect(onCancelUpload).toHaveBeenCalledTimes(1);

    rerender(
      <ComposerHarness
        onSend={vi.fn()}
        uploadState={{
          clientMessageId: 'client-message-1',
          status: 'failed',
          progress: 47,
          errorMessage: 'Upload failed. Retry before leaving this session.',
        }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed. Retry before leaving this session.');
  });

  it('selects, removes, and sends attachment-only payloads', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const file = new File(['hello'], 'message-states-spec.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(screen.getByText('message-states-spec.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith({
      text: '',
      attachments: [
        expect.objectContaining({
          displayName: 'message-states-spec.pdf',
          file,
          kind: 'file',
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Remove message-states-spec.pdf' }));

    expect(screen.queryByText('message-states-spec.pdf')).not.toBeInTheDocument();
  });

  it('sends recorded voice drafts as attachment-only payloads', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const file = new File(['voice'], 'voice-message.webm', { type: 'audio/webm' });
    voiceRecorderMock.current = {
      ...defaultVoiceRecorder(),
      status: 'preview',
      draft: {
        id: 'voice-draft',
        file,
        displayName: 'voice-message.webm',
        mimeType: 'audio/webm',
        size: file.size,
        kind: 'voice',
        durationSeconds: 4,
        localPreviewUrl: 'blob:voice-preview',
      },
      durationSeconds: 4,
    };

    const { container } = render(<ComposerHarness onSend={onSend} />);

    expect(screen.getAllByText('voice-message.webm').length).toBeGreaterThan(0);
    expect(screen.getByText('Voice message - 0:04 - 5 B')).toBeInTheDocument();
    expect(container.querySelector('img[src="blob:voice-preview"]')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith({
      text: '',
      attachments: [
        expect.objectContaining({
          displayName: 'voice-message.webm',
          file,
          kind: 'voice',
          durationSeconds: 4,
        }),
      ],
    });
  });

  it('blocks invalid attachment types until the selection changes', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ComposerHarness onSend={vi.fn()} />);

    const file = new File(['bad'], 'script.exe', { type: 'application/octet-stream' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(screen.getByText('script.exe has an unsupported file type.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('creates and revokes local object URLs for selected media previews', async () => {
    const user = userEvent.setup();
    render(<ComposerHarness onSend={vi.fn()} />);

    const file = new File(['image'], 'diagram.png', { type: 'image/png' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);

    await user.click(screen.getByRole('button', { name: 'Remove diagram.png' }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview');
  });
});
