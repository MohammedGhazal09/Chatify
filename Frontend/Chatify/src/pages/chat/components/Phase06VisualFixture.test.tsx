import { describe, expect, it } from 'vitest';
import {
  PHASE06_CURRENT_USER_ID,
  phase06SelectedMessages,
  phase06VisualFixture,
} from './Phase06VisualFixture';

describe('Phase06VisualFixture', () => {
  it('uses coded non-person labels and fake profilePic inputs', () => {
    const renderedLabels = [
      phase06VisualFixture.currentUser.firstName,
      ...phase06VisualFixture.chats.map((chat) => chat.chatName ?? chat.members.map((member) => member.firstName).join(' ')),
    ].join(' ');

    expect(renderedLabels).not.toMatch(/\b(Ada|Grace|Alan|Lovelace|Hopper|Turing)\b/);
    expect(renderedLabels).toContain('AX-7F3C');
    expect(renderedLabels).toContain('IN-8B21');
    expect(renderedLabels).toContain('Cipher Node');
    expect(phase06VisualFixture.users.every((user) => user.profilePic?.startsWith('https://fixtures.invalid/chatify/'))).toBe(true);
  });

  it('covers required Phase 06 message states', () => {
    expect(phase06SelectedMessages.some((message) => message.sender !== PHASE06_CURRENT_USER_ID)).toBe(true);
    expect(phase06SelectedMessages.some((message) => message.sender === PHASE06_CURRENT_USER_ID && message.status === 'read')).toBe(true);
    expect(phase06SelectedMessages.some((message) => message.optimisticState === 'sending')).toBe(true);
    expect(phase06SelectedMessages.some((message) => message.optimisticState === 'failed')).toBe(true);
    expect(phase06SelectedMessages.some((message) => message.fileChip?.name === 'message-states-spec.pdf')).toBe(true);
    expect(phase06VisualFixture.typingUsers).toEqual([
      expect.objectContaining({ chatId: phase06VisualFixture.selectedChatId, userName: 'IN-8B21', isTyping: true }),
    ]);
  });

  it('includes right-rail-ready data without backend-only behavior', () => {
    expect(phase06VisualFixture.searchMessages.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(phase06VisualFixture.unreadCounts)).toContain(phase06VisualFixture.selectedChatId);
    expect(phase06VisualFixture.presence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userName: 'IN-8B21', isOnline: true }),
      ])
    );
  });
});
