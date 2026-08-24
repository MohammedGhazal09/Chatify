import { describe, expect, it } from 'vitest';
import NotificationOutbox, { NOTIFICATION_CHANNELS } from '../../Models/notificationOutboxModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { claimNextNotificationOutboxJob } from '../../Services/notificationService.mjs';
import { buildMessageNotificationTemplate, serializeOutboxPayload } from '../../Utils/notificationTemplates.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

describe('notification outbox worker claims', () => {
  it('allows only one worker to claim a pending job', async () => {
    await NotificationOutbox.init();
    const sender = await signupWithAgent({ firstName: 'Claim', lastName: 'Sender' });
    const recipient = await signupWithAgent({ firstName: 'Claim', lastName: 'Recipient' });
    const chat = await createDirectChat([sender.user, recipient.user]);
    const message = await Message.create({
      chatId: chat._id,
      sender: sender.user._id,
      clientMessageId: 'claim-message-1',
      text: 'Claim test',
      status: 'sent',
    });
    const job = await NotificationOutbox.create({
      dedupeKey: `${recipient.user._id}:${message._id}:email:claim`,
      recipient: recipient.user._id,
      sender: sender.user._id,
      chatId: chat._id,
      messageId: message._id,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      payload: serializeOutboxPayload(buildMessageNotificationTemplate()),
    });

    const [first, second] = await Promise.all([
      claimNextNotificationOutboxJob({ now: new Date() }),
      claimNextNotificationOutboxJob({ now: new Date() }),
    ]);
    const claimed = [first, second].filter(Boolean);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]._id.toString()).toBe(job._id.toString());
    expect(claimed[0].status).toBe('processing');
    expect(claimed[0].processingToken).toEqual(expect.any(String));
    expect(claimed[0].attempts).toBe(1);
  });
});
