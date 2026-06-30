import { describe, expect, it } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { CHAT_ENCRYPTION_MODES } from '../../Utils/encryptionMode.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupReplyScenario = async () => {
  await Message.init();
  await Chats.init();

  const memberOne = await signupWithAgent({ firstName: 'Reply', lastName: 'Sender' });
  const memberTwo = await signupWithAgent({ firstName: 'Reply', lastName: 'Receiver' });
  const outsider = await signupWithAgent({ firstName: 'Reply', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, outsider, chat };
};

describe('message quoted replies', () => {
  it('persists privacy-safe reply metadata for a visible same-chat source message', async () => {
    const { memberOne, memberTwo, chat } = await setupReplyScenario();
    const source = await createMessage({
      chat,
      sender: memberTwo.user,
      text: '  Original launch note with extra spacing  ',
      clientMessageId: 'reply-source-visible',
    });

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Replying with context',
        clientMessageId: 'reply-create-visible',
        replyToMessageId: source._id.toString(),
      })
      .expect(201);

    expect(response.body.data.message.replyTo).toMatchObject({
      messageId: source._id.toString(),
      sender: memberTwo.user._id.toString(),
      messageType: 'text',
      textPreview: 'Original launch note with extra spacing',
      attachmentCount: 0,
      isDeleted: false,
      isEncrypted: false,
    });
    expect(response.body.data.message.replyTo.createdAt).toBe(source.createdAt.toISOString());
    expect(JSON.stringify(response.body.data.message.replyTo)).not.toContain('email');

    const history = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);
    const reply = history.body.data.messages.find((message) => message.clientMessageId === 'reply-create-visible');

    expect(reply.replyTo).toMatchObject(response.body.data.message.replyTo);
  });

  it('rejects reply sources outside the current chat without leaking source existence', async () => {
    const { memberOne, memberTwo, outsider, chat } = await setupReplyScenario();
    const outsiderChat = await createDirectChat([memberTwo.user, outsider.user]);
    const outsiderMessage = await createMessage({
      chat: outsiderChat,
      sender: outsider.user,
      text: 'Outside chat secret',
      clientMessageId: 'reply-source-outside',
    });

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Cannot quote this',
        clientMessageId: 'reply-source-outside-attempt',
        replyToMessageId: outsiderMessage._id.toString(),
      })
      .expect(404);

    expect(response.body.message).toBe('Original message is not available');
    await expect(Message.countDocuments({
      chatId: chat._id,
      clientMessageId: 'reply-source-outside-attempt',
    })).resolves.toBe(0);
  });

  it('rejects reply sources hidden from the sender or deleted for everyone', async () => {
    const { memberOne, memberTwo, chat } = await setupReplyScenario();
    const hiddenForSender = await createMessage({
      chat,
      sender: memberTwo.user,
      text: 'Hidden for sender',
      clientMessageId: 'reply-source-hidden',
      overrides: {
        deletedFor: [memberOne.user._id],
      },
    });
    const deletedForEveryone = await createMessage({
      chat,
      sender: memberTwo.user,
      text: 'Deleted for everyone',
      clientMessageId: 'reply-source-deleted',
      overrides: {
        deletedForEveryone: true,
        deletedAt: new Date(),
      },
    });

    await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Hidden reply',
        clientMessageId: 'reply-hidden-attempt',
        replyToMessageId: hiddenForSender._id.toString(),
      })
      .expect(404);

    await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Deleted reply',
        clientMessageId: 'reply-deleted-attempt',
        replyToMessageId: deletedForEveryone._id.toString(),
      })
      .expect(404);

    await expect(Message.countDocuments({
      chatId: chat._id,
      clientMessageId: { $in: ['reply-hidden-attempt', 'reply-deleted-attempt'] },
    })).resolves.toBe(0);
  });

  it('keeps reply sends idempotent and rejects a changed reply target for the same clientMessageId', async () => {
    const { memberOne, memberTwo, chat } = await setupReplyScenario();
    const firstSource = await createMessage({
      chat,
      sender: memberTwo.user,
      text: 'First source',
      clientMessageId: 'reply-idempotent-source-1',
    });
    const secondSource = await createMessage({
      chat,
      sender: memberTwo.user,
      text: 'Second source',
      clientMessageId: 'reply-idempotent-source-2',
    });
    const payload = {
      chatId: chat._id.toString(),
      text: 'Idempotent reply',
      clientMessageId: 'reply-idempotent',
      replyToMessageId: firstSource._id.toString(),
    };

    const first = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(201);
    const retry = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(200);
    const conflict = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        ...payload,
        replyToMessageId: secondSource._id.toString(),
      })
      .expect(409);

    expect(retry.body.data.idempotent).toBe(true);
    expect(retry.body.data.message._id).toBe(first.body.data.message._id);
    expect(conflict.body.message).toMatch(/different message text, attachment payload, reply target, or mentions/i);
    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: payload.clientMessageId,
    })).resolves.toBe(1);
  });

  it('blocks server-readable quoted replies in encrypted conversations', async () => {
    const { memberOne, memberTwo } = await setupReplyScenario();
    const encryptedChat = await createDirectChat([memberOne.user, memberTwo.user], {
      encryptionMode: CHAT_ENCRYPTION_MODES.E2EE_V1,
      directKey: [memberOne.user._id.toString(), memberTwo.user._id.toString(), CHAT_ENCRYPTION_MODES.E2EE_V1].sort().join(':'),
    });
    const source = await Message.create({
      chatId: encryptedChat._id,
      sender: memberTwo.user._id,
      clientMessageId: 'encrypted-reply-source',
      text: '',
      messageType: 'encrypted',
      encryptionMode: CHAT_ENCRYPTION_MODES.E2EE_V1,
      encryptedPayload: {
        ciphertext: 'cipher',
        iv: 'iv',
        algorithm: 'AES-GCM',
        keyVersion: 1,
        senderDeviceId: 'device',
        encryptedAt: new Date(),
      },
      status: 'sent',
    });

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: encryptedChat._id.toString(),
        text: '',
        clientMessageId: 'encrypted-reply-attempt',
        replyToMessageId: source._id.toString(),
        encryptedPayload: {
          ciphertext: 'reply-cipher',
          iv: 'reply-iv',
          algorithm: 'AES-GCM',
          keyVersion: 1,
          senderDeviceId: 'device-one',
          encryptedAt: new Date().toISOString(),
        },
      })
      .expect(400);

    expect(response.body.code).toBe('encrypted_replies_unavailable');
    expect(response.body.message).toBe('Replies are unavailable in encrypted conversations in this release.');
    await expect(Message.countDocuments({
      chatId: encryptedChat._id,
      clientMessageId: 'encrypted-reply-attempt',
    })).resolves.toBe(0);
  });
});
