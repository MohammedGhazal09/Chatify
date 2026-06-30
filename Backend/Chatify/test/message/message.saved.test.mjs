import { describe, expect, it } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Message from '../../Models/messageModel.mjs';
import SavedMessage from '../../Models/savedMessageModel.mjs';
import Spaces from '../../Models/spaceModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupDirectScenario = async () => {
  await SavedMessage.init();

  const memberOne = await signupWithAgent({ firstName: 'Save', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Save', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Save', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const message = await createMessage({ chat, sender: memberOne.user, text: 'Remember this' });

  return { memberOne, memberTwo, outsider, chat, message };
};

describe('saved messages', () => {
  it('keeps saved message state private per requester and idempotent', async () => {
    const { memberOne, memberTwo, chat, message } = await setupDirectScenario();

    const firstSaveResponse = await memberOne.agent
      .post(`/api/message/${message._id}/save`)
      .expect(200);
    const secondSaveResponse = await memberOne.agent
      .post(`/api/message/${message._id}/save`)
      .expect(200);
    const memberOneList = await memberOne.agent
      .get('/api/message/saved')
      .expect(200);
    const memberTwoList = await memberTwo.agent
      .get('/api/message/saved')
      .expect(200);
    const memberOneHistory = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);
    const memberTwoHistory = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);

    expect(firstSaveResponse.body.data.message).toMatchObject({
      _id: message._id.toString(),
      savedByRequester: true,
      savedAt: expect.any(String),
    });
    expect(firstSaveResponse.body.data.savedMessage).toMatchObject({
      messageId: message._id.toString(),
      chat: expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({ username: memberOne.user.username }),
          expect.objectContaining({ username: memberTwo.user.username }),
        ]),
      }),
    });
    expect(secondSaveResponse.body.data.message.savedAt).toBe(firstSaveResponse.body.data.message.savedAt);
    expect(await SavedMessage.countDocuments({ message: message._id })).toBe(1);
    expect(memberOneList.body.data.savedMessages).toHaveLength(1);
    expect(memberOneList.body.data.savedMessages[0]).toMatchObject({
      messageId: message._id.toString(),
      chatId: chat._id.toString(),
      savedByRequester: true,
      message: expect.objectContaining({
        text: 'Remember this',
        savedByRequester: true,
      }),
    });
    expect(memberTwoList.body.data.savedMessages).toHaveLength(0);
    expect(memberOneHistory.body.data.messages[0].savedByRequester).toBe(true);
    expect(memberTwoHistory.body.data.messages[0].savedByRequester).toBe(false);

    const unsaveResponse = await memberOne.agent
      .delete(`/api/message/${message._id}/save`)
      .expect(200);
    const memberOneListAfterUnsave = await memberOne.agent
      .get('/api/message/saved')
      .expect(200);

    expect(unsaveResponse.body.data.message).toMatchObject({
      _id: message._id.toString(),
      savedByRequester: false,
      savedAt: null,
    });
    expect(memberOneListAfterUnsave.body.data.savedMessages).toHaveLength(0);
  });

  it('enforces membership and visibility for save and list', async () => {
    const { memberOne, memberTwo, outsider, message } = await setupDirectScenario();

    await outsider.agent
      .post(`/api/message/${message._id}/save`)
      .expect(404);
    await memberTwo.agent
      .post(`/api/message/${message._id}/save`)
      .expect(200);
    await memberTwo.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);

    const hiddenList = await memberTwo.agent
      .get('/api/message/saved')
      .expect(200);
    await memberTwo.agent
      .post(`/api/message/${message._id}/save`)
      .expect(404);

    expect(hiddenList.body.data.savedMessages).toHaveLength(0);

    await memberOne.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);
    await memberOne.agent
      .post(`/api/message/${message._id}/save`)
      .expect(404);
  });

  it('supports group, space-channel, and encrypted saved-message metadata safely', async () => {
    await SavedMessage.init();
    await Chats.init();
    await Spaces.init();
    await Message.init();

    const owner = await signupWithAgent({ firstName: 'SavedGroup', lastName: 'Owner' });
    const member = await signupWithAgent({ firstName: 'SavedGroup', lastName: 'Member' });
    const third = await signupWithAgent({ firstName: 'SavedGroup', lastName: 'Third' });
    const outsider = await signupWithAgent({ firstName: 'SavedGroup', lastName: 'Outsider' });
    const group = await Chats.create({
      chatName: 'Save Review Crew',
      isGroupChat: true,
      groupAdmin: owner.user._id,
      members: [owner.user._id, member.user._id, third.user._id],
    });
    const groupMessage = await createMessage({ chat: group, sender: owner.user, text: 'Group bookmark' });

    await member.agent
      .post(`/api/message/${groupMessage._id}/save`)
      .expect(200);
    await outsider.agent
      .post(`/api/message/${groupMessage._id}/save`)
      .expect(404);

    const createdSpace = await owner.agent
      .post('/api/space')
      .send({
        name: 'Saved Space',
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const channelId = createdSpace.body.data.channel._id;
    const channelMessage = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId: channelId,
        text: 'Space bookmark',
        clientMessageId: 'saved-space-bookmark',
      })
      .expect(201);
    const encryptedMessage = await Message.create({
      chatId: group._id,
      sender: owner.user._id,
      text: '',
      status: 'sent',
      messageType: 'encrypted',
      encryptionMode: 'e2ee_v1',
      encryptedPayload: {
        ciphertext: 'ciphertext',
        iv: 'iv',
      },
    });

    await member.agent
      .post(`/api/message/${channelMessage.body.data.message._id}/save`)
      .expect(200);
    await member.agent
      .post(`/api/message/${encryptedMessage._id}/save`)
      .expect(200);

    const listResponse = await member.agent
      .get('/api/message/saved')
      .expect(200);
    const savedMessages = listResponse.body.data.savedMessages;

    expect(savedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        messageId: groupMessage._id.toString(),
        chat: expect.objectContaining({
          chatName: 'Save Review Crew',
          isGroupChat: true,
        }),
      }),
      expect.objectContaining({
        messageId: channelMessage.body.data.message._id,
        chat: expect.objectContaining({
          isSpaceChannel: true,
          channelName: expect.any(String),
        }),
      }),
      expect.objectContaining({
        messageId: encryptedMessage._id.toString(),
        message: expect.objectContaining({
          text: '',
          messageType: 'encrypted',
          encryptionMode: 'e2ee_v1',
        }),
      }),
    ]));
    expect(JSON.stringify(savedMessages)).not.toContain(member.user.email);
  });
});
