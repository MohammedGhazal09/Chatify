import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.mjs';
import Chats from '../../Models/chatModel.mjs';
import IntegrationInstallation from '../../Models/integrationInstallationModel.mjs';
import Spaces, { SPACE_ROLES } from '../../Models/spaceModel.mjs';
import { INTEGRATION_SCOPES } from '../../Utils/integrationPermissions.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

const setupUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  return {
    ...signedUp,
    csrfToken: await getCsrfForAgent(signedUp.agent),
  };
};

const createApp = (actor) => actor.agent
  .post('/api/integrations/apps')
  .set('X-CSRF-Token', actor.csrfToken)
  .send({
    name: 'Authority Relay',
    type: 'integration',
    allowedScopes: [INTEGRATION_SCOPES.CHANNELS_READ],
  });

const installApp = (actor, appId, targetType, targetId) => actor.agent
  .post(`/api/integrations/apps/${appId}/installations`)
  .set('X-CSRF-Token', actor.csrfToken)
  .send({
    targetType,
    targetId: targetId.toString(),
    scopes: [INTEGRATION_SCOPES.CHANNELS_READ],
  });

describe('integration target authority lifecycle', () => {
  it('requires a standard group administrator to remain a current chat member', async () => {
    const actor = await setupUser({ username: 'group.authority' });
    const member = await setupUser({ username: 'group.member' });
    const group = await Chats.create({
      chatName: 'Authority Group',
      isGroupChat: true,
      groupAdmin: actor.user._id,
      members: [member.user._id],
    });
    const appResponse = await createApp(actor).expect(201);

    await installApp(actor, appResponse.body.data.app._id, 'chat', group._id)
      .expect(403);
  });

  it('revokes a space installation before runtime use after the installer is demoted', async () => {
    const owner = await setupUser({ username: 'space.owner' });
    const installer = await setupUser({ username: 'space.installer' });
    const space = await Spaces.create({
      name: 'Authority Space',
      owner: owner.user._id,
      createdBy: owner.user._id,
      joinCode: 'AUTHSPC1',
      members: [
        { user: owner.user._id, role: SPACE_ROLES.OWNER },
        { user: installer.user._id, role: SPACE_ROLES.ADMIN },
      ],
    });
    const appResponse = await createApp(installer).expect(201);
    const installationResponse = await installApp(
      installer,
      appResponse.body.data.app._id,
      'space',
      space._id
    ).expect(201);
    const { installation, runtimeToken } = installationResponse.body.data;

    await Spaces.updateOne(
      { _id: space._id, 'members.user': installer.user._id },
      { $set: { 'members.$.role': SPACE_ROLES.MEMBER } }
    );

    await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${runtimeToken}`)
      .expect(403);

    await installer.agent
      .post(`/api/integrations/installations/${installation._id}/rotate-token`)
      .set('X-CSRF-Token', installer.csrfToken)
      .send({})
      .expect(403);

    const stored = await IntegrationInstallation.findById(installation._id).lean();
    expect(stored.status).toBe('revoked');
    expect(stored.revokedAt).toBeTruthy();
  });
});
