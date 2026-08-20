import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChat, makeSharedAsset, makeUser } from '../../../test/chatFixtures';
import {
  clearConversationSecret,
  ensureConversationSecret,
  exportConversationRecoveryKey,
  getConversationSecret,
} from '../../../utils/encryptedMessages';
import ConversationDetailContent from './ConversationDetailContent';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

const renderDetailContent = ({
  profilePic = '/api/user/user-2/profile-image?v=1',
  profileBio,
  memberProfileStatus,
  presenceProfileStatus,
  chatOverrides = {},
}: {
  profilePic?: string;
  profileBio?: string;
  memberProfileStatus?: string;
  presenceProfileStatus?: string;
  chatOverrides?: Parameters<typeof makeChat>[0];
} = {}) => {
  const otherMember = makeUser({
    _id: 'user-2',
    firstName: 'Grace',
    lastName: 'Hopper',
    profilePic,
    profileBio,
    profileStatus: memberProfileStatus,
    email: 'grace@example.com',
  });
  const selectedChat = makeChat({
    members: [
      makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' }),
      otherMember,
    ],
    ...chatOverrides,
  });

  render(
    <ConversationDetailContent
      selectedChat={selectedChat}
      currentUserId="user-1"
      otherMember={otherMember}
      otherMemberStatus={{ userId: 'user-2', isOnline: true, profileStatus: presenceProfileStatus }}
      pinnedMessages={[]}
      sharedFiles={[]}
      sharedMedia={[]}
      sharedVoice={[]}
      isPinnedLoading={false}
      isSharedFilesLoading={false}
      isSharedMediaLoading={false}
      isSharedVoiceLoading={false}
      isPinnedError={false}
      isSharedFilesError={false}
      isSharedMediaError={false}
      isSharedVoiceError={false}
      isAuthenticated
      isSocketConnected
      isReconnecting={false}
      isOffline={false}
      onToggleFavorite={vi.fn()}
      onStartAudioCall={vi.fn()}
      onStartVideoCall={vi.fn()}
      onSearchMessages={vi.fn()}
      onOpenMoreMenu={vi.fn()}
      onOpenAttachmentPreview={vi.fn()}
      onOpenVoiceMessages={vi.fn()}
      onJumpToMessage={vi.fn()}
      onUnpinMessage={vi.fn()}
    />
  );
};

const clipboardWriteText = vi.fn();

describe('ConversationDetailContent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clipboardWriteText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
  });

  it('renders the other member profile image in the conversation details surface', () => {
    renderDetailContent();

    expect(screen.getByRole('img', { name: 'Grace Hopper profile picture' })).toHaveAttribute(
      'src',
      'https://backend.test/api/user/user-2/profile-image?v=1'
    );
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('falls back to abstract identity when the detail image fails to load', () => {
    renderDetailContent({ profilePic: '/api/user/user-2/profile-image?v=broken' });

    fireEvent.error(screen.getByRole('img', { name: 'Grace Hopper profile picture' }));

    expect(screen.getByRole('img', { name: 'Grace Hopper profile picture fallback' })).toBeInTheDocument();
  });

  it('renders honest empty states when no persisted shared assets exist', () => {
    renderDetailContent();

    expect(screen.getByText('No shared files')).toBeInTheDocument();
    expect(screen.getByText('No shared media')).toBeInTheDocument();
    expect(screen.getByText('No voice messages')).toBeInTheDocument();
    expect(screen.queryByText('voice-sample.webm')).not.toBeInTheDocument();
    expect(screen.queryByText('delivery-metrics.xlsx')).not.toBeInTheDocument();
    expect(screen.queryByText('Encrypted recovery')).not.toBeInTheDocument();
  });

  it('keeps detail disclosure state independent and keyboard-reachable', () => {
    renderDetailContent();

    const pinnedDisclosure = screen.getByRole('button', { name: /Pinned messages/ });
    const mediaDisclosure = screen.getByRole('button', { name: /Shared media/ });

    expect(pinnedDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(mediaDisclosure).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(pinnedDisclosure);

    expect(pinnedDisclosure).toHaveAttribute('aria-expanded', 'false');
    expect(mediaDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('No shared media')).toBeVisible();

    fireEvent.click(pinnedDisclosure);
    expect(pinnedDisclosure).toHaveAttribute('aria-expanded', 'true');
  });

  it('copies an encrypted conversation recovery key without rendering the raw key', async () => {
    ensureConversationSecret('chat-1');
    const exported = exportConversationRecoveryKey('chat-1');

    expect(exported.ok).toBe(true);

    renderDetailContent({
      chatOverrides: {
        encryptionMode: 'e2ee_v1',
      },
    });

    expect(screen.getByRole('group', { name: 'Encrypted recovery' })).toBeInTheDocument();
    expect(screen.getByText(/Recovery key ready on this device/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Copy recovery key' }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(exported.ok ? exported.recoveryKey : '');
    });
    expect(screen.getByText('Recovery key copied. Store it somewhere private.')).toBeInTheDocument();
    if (exported.ok) {
      expect(screen.queryByText(exported.recoveryKey)).not.toBeInTheDocument();
    }
  });

  it('imports an encrypted conversation recovery key when this device is missing the secret', () => {
    const originalSecret = ensureConversationSecret('chat-1');
    const exported = exportConversationRecoveryKey('chat-1');
    clearConversationSecret('chat-1');

    expect(exported.ok).toBe(true);
    expect(getConversationSecret('chat-1')).toBeNull();

    renderDetailContent({
      chatOverrides: {
        encryptionMode: 'e2ee_v1',
      },
    });

    expect(screen.getByText(/This device needs the recovery key/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Recovery key'), {
      target: { value: exported.ok ? exported.recoveryKey : '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import recovery key' }));

    expect(getConversationSecret('chat-1')).toBe(originalSecret);
    expect(screen.getByText('Recovery key imported on this device.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy recovery key' })).toBeEnabled();
  });

  it('shows a focused recovery import error without saving invalid keys', () => {
    renderDetailContent({
      chatOverrides: {
        encryptionMode: 'e2ee_v1',
      },
    });

    fireEvent.change(screen.getByLabelText('Recovery key'), {
      target: { value: 'not-a-recovery-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import recovery key' }));

    expect(getConversationSecret('chat-1')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Recovery key format is invalid.');
  });

  it('renders public bio and visible profile status without exposing account email', () => {
    renderDetailContent({
      profileBio: 'Building reliable chat tools.',
      memberProfileStatus: 'Do not show stale member status',
      presenceProfileStatus: 'Available for focused work',
    });

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Bio')).toBeInTheDocument();
    expect(screen.getByText('Building reliable chat tools.')).toBeInTheDocument();
    expect(screen.getAllByText('Available for focused work').length).toBeGreaterThan(0);
    expect(screen.queryByText('Do not show stale member status')).not.toBeInTheDocument();
    expect(screen.queryByText('grace@example.com')).not.toBeInTheDocument();
  });

  it('opens persisted voice assets from a compact voice section action', () => {
    const onOpenVoiceMessages = vi.fn();
    const otherMember = makeUser({
      _id: 'user-2',
      firstName: 'Grace',
      lastName: 'Hopper',
    });
    const selectedChat = makeChat({
      members: [
        makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' }),
        otherMember,
      ],
    });

    render(
      <ConversationDetailContent
        selectedChat={selectedChat}
        currentUserId="user-1"
        otherMember={otherMember}
        otherMemberStatus={{ userId: 'user-2', isOnline: true }}
        pinnedMessages={[]}
        sharedFiles={[]}
        sharedMedia={[]}
        sharedVoice={[
          makeSharedAsset({
            attachmentId: 'voice-1',
            messageId: 'message-voice',
            displayName: 'voice-message.webm',
            mimeType: 'audio/webm',
            kind: 'voice',
            size: 5,
            durationSeconds: 4,
          }),
        ]}
        isPinnedLoading={false}
        isSharedFilesLoading={false}
        isSharedMediaLoading={false}
        isSharedVoiceLoading={false}
        isPinnedError={false}
        isSharedFilesError={false}
        isSharedMediaError={false}
        isSharedVoiceError={false}
        isAuthenticated
        isSocketConnected
        isReconnecting={false}
        isOffline={false}
        onToggleFavorite={vi.fn()}
        onStartAudioCall={vi.fn()}
        onStartVideoCall={vi.fn()}
        onSearchMessages={vi.fn()}
        onOpenMoreMenu={vi.fn()}
        onOpenAttachmentPreview={vi.fn()}
        onOpenVoiceMessages={onOpenVoiceMessages}
        onJumpToMessage={vi.fn()}
        onUnpinMessage={vi.fn()}
      />
    );

    expect(screen.getByText('Voice messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show voice messages' })).toBeEnabled();
    expect(screen.getByText('1 voice message')).toBeInTheDocument();
    expect(screen.queryByText('voice-message.webm')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play voice-message.webm' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show voice messages' }));

    expect(onOpenVoiceMessages).toHaveBeenCalledTimes(1);
  });
});
