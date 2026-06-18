import { describe, expect, it } from 'vitest';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupGroupMessageScenario = async () => {
  const owner = await signupWithAgent({ firstName: 'GroupMsg', lastName: 'Owner' });
  const memberTwo = await signupWithAgent({ firstName: 'GroupMsg', lastName: 'Two' });
  const memberThree = await signupWithAgent({ firstName: 'GroupMsg', lastName: 'Three' });
  const outsider = await signupWithAgent({ firstName: 'GroupMsg', lastName: 'Outsider' });

  const groupResponse = await owner.agent
    .post('/api/chat/create-group-chat')
    .send({
      chatName: 'Message Group',
      memberUsernames: [memberTwo.user.username, memberThree.user.username],
    })
    .expect(201);

  return {
    owner,
    memberTwo,
    memberThree,
    outsider,
    chatId: groupResponse.body.data.chat._id,
  };
};

describe('group message access', () => {
  it('allows group members to send, read, and search while rejecting outsiders', async () => {
    const { memberTwo, memberThree, outsider, chatId } = await setupGroupMessageScenario();

    const created = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: 'Group alpha launch note',
        clientMessageId: 'group-alpha-launch-note',
      })
      .expect(201);

    const memberHistory = await memberThree.agent
      .get(`/api/message/get-all-messages/${chatId}`)
      .expect(200);
    const search = await memberThree.agent
      .get(`/api/message/search/${chatId}?q=alpha`)
      .expect(200);
    const outsiderHistory = await outsider.agent
      .get(`/api/message/get-all-messages/${chatId}`)
      .expect(403);
    const outsiderSend = await outsider.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: 'Unauthorized group message',
        clientMessageId: 'unauthorized-group-message',
      })
      .expect(403);

    expect(memberHistory.body.data.messages.map((message) => message._id)).toContain(created.body.data.message._id);
    expect(search.body.data.messages.map((message) => message._id)).toEqual([created.body.data.message._id]);
    expect(outsiderHistory.body.message).toMatch(/not authorized|forbidden or not found/i);
    expect(outsiderSend.body.message).toMatch(/not authorized|forbidden or not found/i);
    expect(JSON.stringify(memberHistory.body)).not.toContain('"email"');
    expect(JSON.stringify(search.body)).not.toContain('"email"');
  });

  it('lets a group member hide another member message only for themselves', async () => {
    const { owner, memberTwo, memberThree, outsider, chatId } = await setupGroupMessageScenario();

    const created = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: 'Group private delete note',
        clientMessageId: 'group-private-delete-note',
      })
      .expect(201);

    const messageId = created.body.data.message._id;

    await memberThree.agent
      .get(`/api/message/${chatId}/unread-count`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.unreadCount).toBe(1);
      });

    const deleteResponse = await memberThree.agent
      .delete(`/api/message/${messageId}`)
      .send({ deleteForEveryone: false })
      .expect(200);
    const hiddenMemberHistory = await memberThree.agent
      .get(`/api/message/get-all-messages/${chatId}`)
      .expect(200);
    const senderHistory = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chatId}`)
      .expect(200);
    const otherMemberHistory = await owner.agent
      .get(`/api/message/get-all-messages/${chatId}`)
      .expect(200);
    const unreadAfterDelete = await memberThree.agent
      .get(`/api/message/${chatId}/unread-count`)
      .expect(200);

    await outsider.agent
      .delete(`/api/message/${messageId}`)
      .send({ deleteForEveryone: false })
      .expect(403);

    expect(deleteResponse.body.data.message.deletedFor).toEqual([memberThree.user._id.toString()]);
    expect(hiddenMemberHistory.body.data.messages.map((message) => message._id)).not.toContain(messageId);
    expect(senderHistory.body.data.messages.map((message) => message._id)).toContain(messageId);
    expect(otherMemberHistory.body.data.messages.map((message) => message._id)).toContain(messageId);
    expect(unreadAfterDelete.body.data.unreadCount).toBe(0);
  });

  it('returns group chats through the existing chat list cache shape', async () => {
    const { owner, memberTwo, chatId } = await setupGroupMessageScenario();

    const ownerChats = await owner.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const memberChats = await memberTwo.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const ownerGroup = ownerChats.body.data.chats.find((chat) => chat._id === chatId);
    const memberGroup = memberChats.body.data.chats.find((chat) => chat._id === chatId);

    expect(ownerGroup).toMatchObject({
      chatName: 'Message Group',
      isGroupChat: true,
      conversationControls: expect.objectContaining({
        isDirectChat: false,
        canSendMessage: true,
      }),
    });
    expect(memberGroup.members).toHaveLength(3);
    expect(JSON.stringify(ownerGroup)).not.toContain('"email"');
    expect(JSON.stringify(memberGroup)).not.toContain('"email"');
  });
});
