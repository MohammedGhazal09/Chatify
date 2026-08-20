import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import AbuseReport from '../../Models/abuseReportModel.mjs';
import PrivacyRequest, { PRIVACY_REQUEST_TYPES } from '../../Models/privacyRequestModel.mjs';
import User from '../../Models/userModel.mjs';
import { CHAT_ENCRYPTION_MODES } from '../../Utils/encryptionMode.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

const exportAccount = (agent, csrfToken) => agent
  .post('/api/user/privacy/export')
  .set('X-CSRF-Token', csrfToken)
  .send({});

const setupUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

describe('user privacy export', () => {
  it('exports only requester-authorized records and omits private peer identity fields', async () => {
    const owner = await setupUser({ firstName: 'Privacy', lastName: 'Owner' });
    const peer = await setupUser({ firstName: 'Privacy', lastName: 'Peer' });
    const outsider = await setupUser({ firstName: 'Privacy', lastName: 'Outsider' });
    const ownerChat = await createDirectChat([owner.user, peer.user], { chatName: 'Portable chat' });
    const outsiderChat = await createDirectChat([peer.user, outsider.user], { chatName: 'Hidden chat' });

    await createMessage({
      chat: ownerChat,
      sender: owner.user,
      text: 'Visible owner message',
    });
    await createMessage({
      chat: ownerChat,
      sender: owner.user,
      text: 'Visible attachment message',
      overrides: {
        attachments: [
          {
            attachmentId: new mongoose.Types.ObjectId(),
            displayName: 'active-export.pdf',
            mimeType: 'application/pdf',
            size: 1200,
            kind: 'file',
            status: 'active',
            createdAt: new Date(),
          },
          {
            attachmentId: new mongoose.Types.ObjectId(),
            displayName: 'deleted-export.pdf',
            mimeType: 'application/pdf',
            size: 2400,
            kind: 'file',
            status: 'deleted',
            createdAt: new Date(),
          },
        ],
      },
    });
    await createMessage({
      chat: ownerChat,
      sender: peer.user,
      text: 'Deleted everywhere body',
      overrides: {
        deletedForEveryone: true,
        deletedAt: new Date(),
        attachments: [
          {
            attachmentId: new mongoose.Types.ObjectId(),
            displayName: 'deleted-everywhere.pdf',
            mimeType: 'application/pdf',
            size: 3200,
            kind: 'file',
            status: 'active',
            createdAt: new Date(),
          },
        ],
      },
    });
    await createMessage({
      chat: ownerChat,
      sender: peer.user,
      text: 'Hidden for owner',
      overrides: {
        deletedFor: [owner.user._id],
      },
    });
    await createMessage({
      chat: ownerChat,
      sender: peer.user,
      text: '',
      overrides: {
        messageType: 'encrypted',
        encryptionMode: CHAT_ENCRYPTION_MODES.E2EE_V1,
        encryptedPayload: {
          ciphertext: 'ciphertext-value',
          iv: 'iv-value',
          algorithm: 'AES-GCM',
          keyVersion: 1,
          senderDeviceId: 'device-1',
          encryptedAt: new Date(),
        },
      },
    });
    await createMessage({
      chat: outsiderChat,
      sender: outsider.user,
      text: 'Unauthorized outsider chat message',
    });
    await AbuseReport.create({
      reporter: owner.user._id,
      targetType: 'message',
      reportedUser: peer.user._id,
      chat: ownerChat._id,
      reason: 'privacy',
      details: 'This report detail should stay out of the export payload.',
      context: {
        message: {
          textPreview: 'redacted preview',
        },
      },
    });

    const response = await exportAccount(owner.agent, owner.csrfToken).expect(200);
    const payloadText = JSON.stringify(response.body);
    const exported = response.body.data.export;

    expect(exported.account.email).toBe(owner.user.email);
    expect(exported.chats).toHaveLength(1);
    expect(exported.chats[0].chatName).toBe('Portable chat');
    expect(exported.messages.map((message) => message.text)).toContain('Visible owner message');
    expect(exported.messages.map((message) => message.text)).not.toContain('Hidden for owner');
    expect(payloadText).toContain('active-export.pdf');
    expect(payloadText).not.toContain('deleted-export.pdf');
    expect(payloadText).not.toContain('deleted-everywhere.pdf');
    expect(payloadText).not.toContain('Unauthorized outsider chat message');
    expect(payloadText).not.toContain(peer.user.email);
    expect(payloadText).not.toContain(outsider.user.email);
    expect(payloadText).not.toContain('This report detail should stay out of the export payload.');

    const encryptedExport = exported.messages.find((message) => message.messageType === 'encrypted');
    expect(encryptedExport).toMatchObject({
      text: '',
      exportLimitation: expect.stringContaining('Encrypted message plaintext'),
      encryptedPayload: expect.objectContaining({
        ciphertext: 'ciphertext-value',
        iv: 'iv-value',
      }),
    });
    const deletedEverywhereExport = exported.messages.find((message) => message.deletedForEveryone === true);
    expect(deletedEverywhereExport).toMatchObject({
      text: '',
      attachments: [],
    });

    const audit = await PrivacyRequest.findOne({
      user: owner.user._id,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
    }).lean();
    expect(audit).toMatchObject({
      recordCounts: expect.objectContaining({
        chats: 1,
        messages: 4,
        attachments: 1,
        reports: 1,
      }),
    });
    expect(JSON.stringify(audit)).not.toContain('Visible owner message');
    expect(JSON.stringify(audit)).not.toContain(owner.user.email);
  });

  it('requires CSRF for export requests', async () => {
    const owner = await setupUser({ firstName: 'Privacy', lastName: 'Csrf' });

    await owner.agent
      .post('/api/user/privacy/export')
      .send({})
      .expect(403);
  });
});
