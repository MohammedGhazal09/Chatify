import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.mjs';
import Chats from '../../Models/chatModel.mjs';
import IntegrationInstallation, {
  INTEGRATION_INSTALLATION_STATUSES,
} from '../../Models/integrationInstallationModel.mjs';
import Spaces, { SPACE_ROLES } from '../../Models/spaceModel.mjs';
import User from '../../Models/userModel.mjs';
import { INTEGRATION_SCOPES } from '../../Utils/integrationPermissions.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketAsUser,
  emitWithAck,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];

const setupUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

const createSpace = ({ owner, admins = [], members = [], name = 'Phase Six Space' }) => Spaces.create({
  name,
  description: 'Phase 6 authorization target',
  owner: owner.user._id,
  createdBy: owner.user._id,
  members: [
    { user: owner.user._id, role: SPACE_ROLES.OWNER },
    ...admins.map((user) => ({ user: user.user._id, role: SPACE_ROLES.ADMIN })),
    ...members.map((user) => ({ user: user.user._id, role: SPACE_ROLES.MEMBER })),
  ],
  joinCode: `P6${owner.user._id.toString().slice(-6).toUpperCase()}`,
});

const createIntegrationApp = (actor, overrides = {}) => actor.agent
  .post('/api/integrations/apps')
  .set('X-CSRF-Token', actor.csrfToken)
  .send({
    name: 'Phase Six Relay',
    description: 'Authorization regression integration',
    type: 'integration',
    allowedScopes: [INTEGRATION_SCOPES.CHANNELS_READ],
    ...overrides,
  });

const installIntegrationApp = (actor, appId, payload) => actor.agent
  .post(`/api/integrations/apps/${appId}/installations`)
  .set('X-CSRF-Token', actor.csrfToken)
  .send(payload);

afterEach(async () => {
  sockets.splice(0).forEach((socket) => {
    if (socket.connected || socket.active) socket.disconnect();
  });

  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe('Phase 6 authorization and access-control invariants', () => {
  it('prevents a space administrator from granting administrator authority', async () => {
    const owner = await setupUser({ firstName: 'Space', lastName: 'Owner' });
    const administrator = await setupUser({ firstName: 'Space', lastName: 'Admin' });
    const target = await setupUser({ firstName: 'Space', lastName: 'Target' });
    const space = await createSpace({ owner, admins: [administrator] });

    const response = await administrator.agent
      .post(`/api/space/${space._id}/members`)
      .set('X-CSRF-Token', administrator.csrfToken)
      .send({
        username: target.user.username,
        role: SPACE_ROLES.ADMIN,
      })
      .expect(403);

    expect(response.body.message).toMatch(/owner.*administrator|owner.*admin/i);
    expect(await Spaces.exists({
      _id: space._id,
      members: {
        $elemMatch: {
          user: target.user._id,
          role: SPACE_ROLES.ADMIN,
        },
      },
    })).toBeNull();
  });

  it('prevents a space administrator from removing a peer administrator while allowing the owner', async () => {
    const owner = await setupUser({ firstName: 'Space', lastName: 'Owner Remove' });
    const administrator = await setupUser({ firstName: 'Space', lastName: 'Admin Remove' });
    const peerAdministrator = await setupUser({ firstName: 'Space', lastName: 'Peer Admin' });
    const space = await createSpace({ owner, admins: [administrator, peerAdministrator] });

    const denied = await administrator.agent
      .delete(`/api/space/${space._id}/members/${peerAdministrator.user._id}`)
      .set('X-CSRF-Token', administrator.csrfToken)
      .expect(403);

    expect(denied.body.message).toMatch(/owner.*administrator|owner.*admin/i);
    expect(await Spaces.exists({
      _id: space._id,
      members: {
        $elemMatch: {
          user: peerAdministrator.user._id,
          role: SPACE_ROLES.ADMIN,
        },
      },
    })).toBeTruthy();

    await owner.agent
      .delete(`/api/space/${space._id}/members/${peerAdministrator.user._id}`)
      .set('X-CSRF-Token', owner.csrfToken)
      .expect(200);

    expect(await Spaces.exists({
      _id: space._id,
      'members.user': peerAdministrator.user._id,
    })).toBeNull();
  });

  it('revokes runtime integration authority when the installer loses target-manager authority', async () => {
    const owner = await setupUser({ firstName: 'Integration', lastName: 'Space Owner' });
    const installer = await setupUser({ firstName: 'Integration', lastName: 'Space Admin' });
    const space = await createSpace({ owner, admins: [installer] });
    const appResponse = await createIntegrationApp(installer).expect(201);
    const appId = appResponse.body.data.app._id;
    const installResponse = await installIntegrationApp(installer, appId, {
      targetType: 'space',
      targetId: space._id.toString(),
      scopes: [INTEGRATION_SCOPES.CHANNELS_READ],
    }).expect(201);
    const { installation, runtimeToken } = installResponse.body.data;

    await owner.agent
      .delete(`/api/space/${space._id}/members/${installer.user._id}`)
      .set('X-CSRF-Token', owner.csrfToken)
      .expect(200);

    const deniedRuntime = await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${runtimeToken}`)
      .expect(403);

    expect(deniedRuntime.body.message).toMatch(/revoked/i);
    await expect(IntegrationInstallation.findById(installation._id).lean()).resolves.toMatchObject({
      status: INTEGRATION_INSTALLATION_STATUSES.REVOKED,
    });

    const deniedRotation = await installer.agent
      .post(`/api/integrations/installations/${installation._id}/rotate-token`)
      .set('X-CSRF-Token', installer.csrfToken)
      .send({})
      .expect(404);

    expect(deniedRotation.body.message).toBe('Integration installation not found');
  });

  it('does not trust a stale groupAdmin field when the actor is no longer a group member', async () => {
    const installer = await setupUser({ firstName: 'Integration', lastName: 'Stale Admin' });
    const memberOne = await setupUser({ firstName: 'Group', lastName: 'One' });
    const memberTwo = await setupUser({ firstName: 'Group', lastName: 'Two' });
    const memberThree = await setupUser({ firstName: 'Group', lastName: 'Three' });
    const chat = await Chats.create({
      chatName: 'Stale group authority',
      isGroupChat: true,
      isSpaceChannel: false,
      groupAdmin: installer.user._id,
      members: [memberOne.user._id, memberTwo.user._id, memberThree.user._id],
    });
    const appResponse = await createIntegrationApp(installer).expect(201);

    const response = await installIntegrationApp(installer, appResponse.body.data.app._id, {
      targetType: 'chat',
      targetId: chat._id.toString(),
      scopes: [INTEGRATION_SCOPES.CHANNELS_READ],
    }).expect(403);

    expect(response.body.message).toMatch(/group admin/i);
    expect(await IntegrationInstallation.countDocuments({ targetId: chat._id })).toBe(0);
  });

  it('loads the administrator role from current database state on every request', async () => {
    const administrator = await setupUser({ firstName: 'Current', lastName: 'Administrator' });
    await User.findByIdAndUpdate(administrator.user._id, { role: 'admin' });

    await administrator.agent
      .get('/api/admin/delivery-health')
      .expect(200);

    await User.findByIdAndUpdate(administrator.user._id, { role: 'user' });

    const denied = await administrator.agent
      .get('/api/admin/delivery-health')
      .expect(403);

    expect(denied.body.message).toBe('Admin access required');
  });

  it('re-authorizes stored chat membership even when a socket is still joined to the room', async () => {
    const server = await startSocketTestServer();
    servers.push(server);
    const member = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Member' });
    const peer = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Peer' });
    sockets.push(member.socket, peer.socket);
    const chat = await createDirectChat([member.user, peer.user]);
    const chatId = chat._id.toString();

    await emitWithAck(member.socket, 'chat:join', chatId);
    await Chats.updateOne({ _id: chat._id }, { $pull: { members: member.user._id } });

    const response = await emitWithAck(member.socket, 'typing:start', { chatId });

    expect(response).toMatchObject({
      ok: false,
      event: 'typing:start',
      code: 'forbidden_or_not_found',
      message: 'Forbidden or not found',
    });
  });
});
