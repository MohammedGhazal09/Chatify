import { describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { attachPdf } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupPinScenario = async () => {
  const memberOne = await signupWithAgent({ firstName: 'Pin', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Pin', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Pin', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const message = await createMessage({ chat, sender: memberOne.user, text: 'Pin this message' });

  return { memberOne, memberTwo, outsider, chat, message };
};

describe('pinned messages', () => {
  it('lets chat members pin, list, and unpin visible messages', async () => {
    const { memberOne, memberTwo, chat, message } = await setupPinScenario();

    const pinResponse = await memberTwo.agent
      .post(`/api/message/${message._id}/pin`)
      .expect(200);
    const listResponse = await memberOne.agent
      .get(`/api/message/${chat._id}/pinned`)
      .expect(200);
    const unpinResponse = await memberOne.agent
      .delete(`/api/message/${message._id}/pin`)
      .expect(200);

    expect(pinResponse.body.data.message).toMatchObject({
      _id: message._id.toString(),
      pinned: true,
      pinnedBy: memberTwo.user._id.toString(),
      pinnedAt: expect.any(String),
    });
    expect(listResponse.body.data.pinnedMessages).toHaveLength(1);
    expect(listResponse.body.data.pinnedMessages[0]).toMatchObject({
      messageId: message._id.toString(),
      text: 'Pin this message',
      pinned: true,
    });
    expect(unpinResponse.body.data.message.pinned).toBe(false);
  });

  it('rejects non-members and tombstones for pin mutations', async () => {
    const { memberOne, outsider, message } = await setupPinScenario();

    await outsider.agent
      .post(`/api/message/${message._id}/pin`)
      .expect(403);
    await memberOne.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);
    await memberOne.agent
      .post(`/api/message/${message._id}/pin`)
      .expect(400);
  });

  it('serializes pinned attachment-only messages for detail surfaces', async () => {
    const memberOne = await signupWithAgent({ firstName: 'PinAttach', lastName: 'One' });
    const memberTwo = await signupWithAgent({ firstName: 'PinAttach', lastName: 'Two' });
    const chat = await createDirectChat([memberOne.user, memberTwo.user]);
    const created = await attachPdf(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('clientMessageId', 'pin-attachment-only')
    ).expect(201);

    await memberTwo.agent
      .post(`/api/message/${created.body.data.message._id}/pin`)
      .expect(200);
    const listResponse = await memberTwo.agent
      .get(`/api/message/${chat._id}/pinned`)
      .expect(200);

    expect(listResponse.body.data.pinnedMessages[0].text).toBe('');
    expect(listResponse.body.data.pinnedMessages[0].attachments).toHaveLength(1);
    expect(listResponse.body.data.pinnedMessages[0].attachments[0].displayName).toBe('message-states-spec.pdf');
  });

  it('enforces the per-chat pinned message cap', async () => {
    const { memberOne, memberTwo, chat } = await setupPinScenario();

    const messages = await Promise.all(Array.from({ length: 51 }, (_, index) => (
      createMessage({ chat, sender: memberOne.user, text: `Pinned ${index}` })
    )));

    await Message.updateMany(
      { _id: { $in: messages.slice(0, 50).map((message) => message._id) } },
      {
        $set: {
          pinned: true,
          pinnedBy: memberOne.user._id,
          pinnedAt: new Date(),
        },
      }
    );

    const response = await memberTwo.agent
      .post(`/api/message/${messages[50]._id}/pin`)
      .expect(400);

    expect(response.body.message).toMatch(/maximum 50 pinned messages/i);
  });
});
