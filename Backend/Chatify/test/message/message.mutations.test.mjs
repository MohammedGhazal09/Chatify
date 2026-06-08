import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupMutationScenario = async () => {
  await Message.init();

  const memberOne = await signupWithAgent({ firstName: 'Member', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Member', lastName: 'Two' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, chat };
};

describe('message mutation semantics', () => {
  it('lets any visible member delete for self without hiding the message from other members', async () => {
    const { memberOne, memberTwo, chat } = await setupMutationScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Hide for recipient only' });

    const deleteResponse = await memberTwo.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);
    const recipientHistory = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);
    const senderHistory = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);
    const recipientUnread = await memberTwo.agent
      .get(`/api/message/${chat._id}/unread-count`)
      .expect(200);

    expect(deleteResponse.body.data.message.deletedFor).toEqual([memberTwo.user._id.toString()]);
    expect(recipientHistory.body.data.messages).toEqual([]);
    expect(senderHistory.body.data.messages).toHaveLength(1);
    expect(senderHistory.body.data.messages[0]._id).toBe(message._id.toString());
    expect(recipientUnread.body.data.unreadCount).toBe(0);
  });

  it('keeps delete-for-everyone as a stable redacted tombstone', async () => {
    const { memberOne, memberTwo, chat } = await setupMutationScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Remove this content' });

    await memberTwo.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(403);
    const deleteResponse = await memberOne.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);
    const storedMessage = await Message.findById(message._id);
    const recipientHistory = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);

    expect(storedMessage).toBeTruthy();
    expect(storedMessage._id.toString()).toBe(message._id.toString());
    expect(storedMessage.text).toBe('');
    expect(storedMessage.deletedForEveryone).toBe(true);
    expect(deleteResponse.body.data.message).toMatchObject({
      _id: message._id.toString(),
      text: '',
      deletedForEveryone: true,
      deletedBy: memberOne.user._id.toString(),
      deletedAt: expect.any(String),
    });
    expect(recipientHistory.body.data.messages).toHaveLength(1);
    expect(recipientHistory.body.data.messages[0]).toMatchObject({
      _id: message._id.toString(),
      text: '',
      deletedForEveryone: true,
    });
  });

  it('edits only sender-owned visible non-tombstone messages inside the edit window', async () => {
    const { memberOne, memberTwo, chat } = await setupMutationScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Before edit' });
    const expiredMessage = await createMessage({
      chat,
      sender: memberOne.user,
      text: 'Expired edit',
      overrides: {
        createdAt: new Date(Date.now() - 16 * 60 * 1000),
        updatedAt: new Date(Date.now() - 16 * 60 * 1000),
      },
    });
    const tombstone = await createMessage({
      chat,
      sender: memberOne.user,
      text: '',
      overrides: {
        deletedForEveryone: true,
        deletedBy: memberOne.user._id,
        deletedAt: new Date(),
      },
    });

    await memberTwo.agent
      .patch(`/api/message/${message._id}/edit`)
      .send({ text: 'Not allowed' })
      .expect(403);
    await memberOne.agent
      .patch(`/api/message/${message._id}/edit`)
      .send({ text: 'x'.repeat(1001) })
      .expect(400);
    await memberOne.agent
      .patch(`/api/message/${expiredMessage._id}/edit`)
      .send({ text: 'Too late' })
      .expect(400);
    await memberOne.agent
      .patch(`/api/message/${tombstone._id}/edit`)
      .send({ text: 'Cannot edit tombstone' })
      .expect(400);

    const editResponse = await memberOne.agent
      .patch(`/api/message/${message._id}/edit`)
      .send({ text: ' After edit ' })
      .expect(200);

    expect(editResponse.body.data.message).toMatchObject({
      _id: message._id.toString(),
      text: 'After edit',
      isEdited: true,
      editedAt: expect.any(String),
    });
  });

  it('toggles reactions idempotently and enforces reaction bounds', async () => {
    const { memberOne, memberTwo, chat } = await setupMutationScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'React here' });
    const fullReactionMessage = await createMessage({
      chat,
      sender: memberOne.user,
      text: 'Too many reactions',
      overrides: {
        reactions: Array.from({ length: 50 }, (_, index) => ({
          user: new mongoose.Types.ObjectId(),
          emoji: `r${index}`,
        })),
      },
    });

    const addResponse = await memberTwo.agent
      .post(`/api/message/${message._id}/reaction`)
      .send({ emoji: 'ok' })
      .expect(200);
    const removeResponse = await memberTwo.agent
      .post(`/api/message/${message._id}/reaction`)
      .send({ emoji: 'ok' })
      .expect(200);
    const oversizedResponse = await memberTwo.agent
      .post(`/api/message/${message._id}/reaction`)
      .send({ emoji: 'x'.repeat(33) })
      .expect(400);
    const fullResponse = await memberTwo.agent
      .post(`/api/message/${fullReactionMessage._id}/reaction`)
      .send({ emoji: 'new' })
      .expect(400);

    expect(addResponse.body.data.action).toBe('added');
    expect(addResponse.body.data.reactions).toEqual([
      {
        user: memberTwo.user._id.toString(),
        emoji: 'ok',
      },
    ]);
    expect(removeResponse.body.data.action).toBe('removed');
    expect(removeResponse.body.data.reactions).toEqual([]);
    expect(oversizedResponse.body.message).toMatch(/maximum length/i);
    expect(fullResponse.body.message).toMatch(/maximum 50 reactions/i);
  });

  it('rejects reactions from a user who deleted the message for self', async () => {
    const { memberOne, memberTwo, chat } = await setupMutationScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Self-hidden reaction' });

    await memberTwo.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);
    await memberTwo.agent
      .post(`/api/message/${message._id}/reaction`)
      .send({ emoji: 'ok' })
      .expect(404);
  });
});
