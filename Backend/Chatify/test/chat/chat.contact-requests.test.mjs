import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import ContactRequest, { CONTACT_REQUEST_STATUSES } from '../../Models/contactRequestModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { emitToUserSockets, joinUserToChat } from '../../Config/socket.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Config/socket.mjs', () => ({
  emitToUserSockets: vi.fn(),
  joinUserToChat: vi.fn(),
  removeUserFromChat: vi.fn(),
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

const GENERIC_START_ERROR = /could not start or continue that chat/i;
const GENERIC_REQUEST_ERROR = /could not update that request/i;

const setupContactRequestUsers = async () => {
  await Chats.init();
  await ContactRequest.init();
  await UserBlock.init();

  const requester = await signupWithAgent({
    firstName: 'Contact',
    lastName: 'Requester',
  });
  const recipient = await signupWithAgent({
    firstName: 'Contact',
    lastName: 'Recipient',
  });
  const outsider = await signupWithAgent({
    firstName: 'Contact',
    lastName: 'Outsider',
  });

  return { requester, recipient, outsider };
};

describe('contact request onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and reuses a pending request without creating a standard direct chat', async () => {
    const { requester, recipient } = await setupContactRequestUsers();

    const created = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetUsername: recipient.user.username })
      .expect(202);

    expect(created.body.data.contactRequest).toMatchObject({
      status: CONTACT_REQUEST_STATUSES.PENDING,
      direction: 'outgoing',
      recipient: expect.objectContaining({ username: recipient.user.username }),
    });
    expect(JSON.stringify(created.body.data.contactRequest)).not.toContain('"email"');
    expect(JSON.stringify(created.body.data.contactRequest)).not.toContain(recipient.user.email);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(0);
    expect(await ContactRequest.countDocuments({ status: CONTACT_REQUEST_STATUSES.PENDING })).toBe(1);
    expect(emitToUserSockets).toHaveBeenCalledTimes(1);
    expect(emitToUserSockets.mock.calls[0][0].toString()).toBe(recipient.user._id.toString());
    expect(emitToUserSockets.mock.calls[0][1]).toBe('contact-request:created');

    vi.clearAllMocks();
    const reused = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetUsername: recipient.user.username })
      .expect(202);

    expect(reused.body.data.contactRequest._id).toBe(created.body.data.contactRequest._id);
    expect(await ContactRequest.countDocuments({ status: CONTACT_REQUEST_STATUSES.PENDING })).toBe(1);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(0);
    expect(emitToUserSockets).not.toHaveBeenCalled();
  });

  it('lists incoming and outgoing pending requests with public identity only', async () => {
    const { requester, recipient } = await setupContactRequestUsers();

    await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: recipient.user.username })
      .expect(201);

    const incoming = await recipient.agent
      .get('/api/chat/contact-requests')
      .expect(200);
    const outgoing = await requester.agent
      .get('/api/chat/contact-requests')
      .expect(200);

    expect(incoming.body.data.incoming).toHaveLength(1);
    expect(incoming.body.data.outgoing).toHaveLength(0);
    expect(incoming.body.data.incoming[0]).toMatchObject({
      direction: 'incoming',
      requester: expect.objectContaining({ username: requester.user.username }),
    });
    expect(outgoing.body.data.outgoing).toHaveLength(1);
    expect(outgoing.body.data.outgoing[0]).toMatchObject({
      direction: 'outgoing',
      recipient: expect.objectContaining({ username: recipient.user.username }),
    });
    expect(JSON.stringify(incoming.body.data)).not.toContain('"email"');
    expect(JSON.stringify(outgoing.body.data)).not.toContain('"email"');
  });

  it('accepts an incoming request, creates one direct chat, and preserves continuation semantics', async () => {
    const { requester, recipient } = await setupContactRequestUsers();
    const created = await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: recipient.user.username })
      .expect(201);
    vi.clearAllMocks();

    const accepted = await recipient.agent
      .post(`/api/chat/contact-requests/${created.body.data.contactRequest._id}/accept`)
      .expect(200);

    const request = await ContactRequest.findById(created.body.data.contactRequest._id);
    const chat = await Chats.findById(accepted.body.data.chat._id);

    expect(request.status).toBe(CONTACT_REQUEST_STATUSES.ACCEPTED);
    expect(request.chat.toString()).toBe(chat._id.toString());
    expect(accepted.body.data.contactRequest).toMatchObject({
      status: CONTACT_REQUEST_STATUSES.ACCEPTED,
      direction: 'incoming',
      chat: chat._id.toString(),
    });
    expect(accepted.body.data.chat.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: requester.user.username }),
        expect.objectContaining({ username: recipient.user.username }),
      ])
    );
    expect(JSON.stringify(accepted.body.data)).not.toContain('"email"');
    expect(joinUserToChat).toHaveBeenCalledTimes(2);
    expect(emitToUserSockets.mock.calls.map((call) => call[1])).toEqual(
      expect.arrayContaining(['chat:new', 'contact-request:updated'])
    );
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(1);

    vi.clearAllMocks();
    const continued = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetUsername: recipient.user.username })
      .expect(200);

    expect(continued.body.data.chat._id).toBe(chat._id.toString());
    expect(joinUserToChat).not.toHaveBeenCalled();
    expect(emitToUserSockets).not.toHaveBeenCalled();
  });

  it('declines and cancels pending requests without creating chats and enforces ownership', async () => {
    const { requester, recipient, outsider } = await setupContactRequestUsers();
    const first = await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: recipient.user.username })
      .expect(201);

    const outsiderAccept = await outsider.agent
      .post(`/api/chat/contact-requests/${first.body.data.contactRequest._id}/accept`)
      .expect(404);
    expect(outsiderAccept.body.message).toMatch(GENERIC_REQUEST_ERROR);

    const declined = await recipient.agent
      .post(`/api/chat/contact-requests/${first.body.data.contactRequest._id}/decline`)
      .expect(200);
    expect(declined.body.data.contactRequest.status).toBe(CONTACT_REQUEST_STATUSES.DECLINED);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(0);

    const second = await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: recipient.user.username })
      .expect(201);
    expect(second.body.data.contactRequest._id).not.toBe(first.body.data.contactRequest._id);

    const recipientCancel = await recipient.agent
      .delete(`/api/chat/contact-requests/${second.body.data.contactRequest._id}`)
      .expect(404);
    expect(recipientCancel.body.message).toMatch(GENERIC_REQUEST_ERROR);

    const canceled = await requester.agent
      .delete(`/api/chat/contact-requests/${second.body.data.contactRequest._id}`)
      .expect(200);
    expect(canceled.body.data.contactRequest.status).toBe(CONTACT_REQUEST_STATUSES.CANCELED);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(0);
  });

  it('rejects self, missing, and blocked targets without creating contact requests', async () => {
    const { requester, recipient } = await setupContactRequestUsers();

    const selfTarget = await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: requester.user.username })
      .expect(400);
    const missingTarget = await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: 'missing.account' })
      .expect(404);

    await UserBlock.create({
      blocker: recipient.user._id,
      blockedUser: requester.user._id,
    });
    const blockedTarget = await requester.agent
      .post('/api/chat/contact-requests')
      .send({ targetUsername: recipient.user.username })
      .expect(404);

    expect(selfTarget.body.message).toMatch(GENERIC_START_ERROR);
    expect(missingTarget.body.message).toMatch(GENERIC_START_ERROR);
    expect(blockedTarget.body.message).toMatch(GENERIC_START_ERROR);
    expect(await ContactRequest.countDocuments()).toBe(0);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(0);
  });
});
