import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import User from '../../Models/userModel.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

const VALID_PUSH_KEYS = {
  p256dh: Buffer.alloc(65, 1).toString('base64url'),
  auth: Buffer.alloc(16, 2).toString('base64url'),
};

describe('notification preferences API', () => {
  it('returns safe defaults and updates server-owned preferences', async () => {
    const member = await signupWithAgent({ firstName: 'Notify', lastName: 'Owner' });
    const csrfToken = await getCsrfForAgent(member.agent);
    const mutedChatId = new mongoose.Types.ObjectId().toString();

    const defaults = await member.agent
      .get('/api/user/notification-preferences')
      .expect(200);

    expect(defaults.body.data.preferences).toMatchObject({
      pushEnabled: false,
      emailNotificationsEnabled: false,
      messagePreviewMode: 'none',
      mutedChatIds: [],
      emailUnsubscribed: false,
      pushSubscriptionCount: 0,
    });

    const updated = await member.agent
      .patch('/api/user/notification-preferences')
      .set('X-CSRF-Token', csrfToken)
      .send({
        pushEnabled: true,
        emailNotificationsEnabled: true,
        messagePreviewMode: 'none',
        mutedChatIds: [mutedChatId, mutedChatId],
      })
      .expect(200);

    expect(updated.body.data.preferences).toMatchObject({
      pushEnabled: true,
      emailNotificationsEnabled: true,
      messagePreviewMode: 'none',
      mutedChatIds: [mutedChatId],
    });
  });

  it('rejects unsupported preview modes and invalid muted chat ids', async () => {
    const member = await signupWithAgent({ firstName: 'Notify', lastName: 'Invalid' });
    const csrfToken = await getCsrfForAgent(member.agent);

    await member.agent
      .patch('/api/user/notification-preferences')
      .set('X-CSRF-Token', csrfToken)
      .send({ messagePreviewMode: 'content' })
      .expect(400);

    await member.agent
      .patch('/api/user/notification-preferences')
      .set('X-CSRF-Token', csrfToken)
      .send({ mutedChatIds: ['not-an-object-id'] })
      .expect(400);
  });

  it('registers and removes push subscriptions without returning endpoint secrets', async () => {
    const member = await signupWithAgent({ firstName: 'Notify', lastName: 'Push' });
    const csrfToken = await getCsrfForAgent(member.agent);
    const endpoint = 'https://fcm.googleapis.com/fcm/send/subscription-user-1';

    const registered = await member.agent
      .post('/api/user/push-subscriptions')
      .set('X-CSRF-Token', csrfToken)
      .send({
        endpoint,
        keys: VALID_PUSH_KEYS,
      })
      .expect(200);

    expect(registered.body.data.preferences).toMatchObject({
      pushEnabled: true,
      pushSubscriptionCount: 1,
    });
    expect(JSON.stringify(registered.body)).not.toContain(endpoint);

    const storedUser = await User.findById(member.user._id)
      .select('notificationPreferences');
    expect(storedUser.notificationPreferences.pushSubscriptions).toHaveLength(1);

    const removed = await member.agent
      .delete('/api/user/push-subscriptions')
      .set('X-CSRF-Token', csrfToken)
      .send({ endpoint })
      .expect(200);

    expect(removed.body.data.preferences.pushSubscriptionCount).toBe(0);
  });

  it('records an authenticated email unsubscribe preference', async () => {
    const member = await signupWithAgent({ firstName: 'Notify', lastName: 'Email' });
    const csrfToken = await getCsrfForAgent(member.agent);

    const response = await member.agent
      .post('/api/user/notification-preferences/email-unsubscribe')
      .set('X-CSRF-Token', csrfToken)
      .expect(200);

    expect(response.body.data.preferences).toMatchObject({
      emailNotificationsEnabled: false,
      emailUnsubscribed: true,
    });

    const resubscribed = await member.agent
      .patch('/api/user/notification-preferences')
      .set('X-CSRF-Token', csrfToken)
      .send({ emailNotificationsEnabled: true })
      .expect(200);

    expect(resubscribed.body.data.preferences).toMatchObject({
      emailNotificationsEnabled: true,
      emailUnsubscribed: false,
    });
  });

  it('rejects private, local, credentialed, and unapproved push endpoints', async () => {
    const member = await signupWithAgent({ firstName: 'Notify', lastName: 'Ssrf' });
    const csrfToken = await getCsrfForAgent(member.agent);
    const endpoints = [
      'https://127.0.0.1/internal',
      'https://[::1]/internal',
      'https://localhost/internal',
      'https://user:password@fcm.googleapis.com/fcm/send/secret',
      'https://attacker.example/push',
      'https://fcm.googleapis.com:8443/fcm/send/secret',
    ];

    for (const endpoint of endpoints) {
      await member.agent
        .post('/api/user/push-subscriptions')
        .set('X-CSRF-Token', csrfToken)
        .send({ endpoint, keys: VALID_PUSH_KEYS })
        .expect(400);
    }
  });

  it('rejects malformed web-push key material', async () => {
    const member = await signupWithAgent({ firstName: 'Notify', lastName: 'Keys' });
    const csrfToken = await getCsrfForAgent(member.agent);
    const endpoint = 'https://fcm.googleapis.com/fcm/send/subscription-user-keys';

    await member.agent
      .post('/api/user/push-subscriptions')
      .set('X-CSRF-Token', csrfToken)
      .send({ endpoint, keys: { p256dh: 'not-base64url*', auth: 'short' } })
      .expect(400);
  });

});
