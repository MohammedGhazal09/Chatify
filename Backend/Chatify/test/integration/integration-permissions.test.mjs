import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.mjs';
import Chats from '../../Models/chatModel.mjs';
import IntegrationAuditLog, { INTEGRATION_AUDIT_ACTIONS } from '../../Models/integrationAuditLogModel.mjs';
import IntegrationInstallation from '../../Models/integrationInstallationModel.mjs';
import Spaces, { SPACE_ROLES } from '../../Models/spaceModel.mjs';
import User from '../../Models/userModel.mjs';
import { INTEGRATION_SCOPES } from '../../Utils/integrationPermissions.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

const setupUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

const createSpace = (owner, member) => Spaces.create({
  name: 'Integration Ops',
  description: 'Permission runtime target',
  owner: owner.user._id,
  createdBy: owner.user._id,
  members: [
    { user: owner.user._id, role: SPACE_ROLES.OWNER },
    { user: member.user._id, role: SPACE_ROLES.MEMBER },
  ],
  joinCode: `INT${owner.user._id.toString().slice(-6).toUpperCase()}`,
});

const createGroupChat = (owner, member, third) => Chats.create({
  chatName: 'Integration group',
  isGroupChat: true,
  groupAdmin: owner.user._id,
  members: [owner.user._id, member.user._id, third.user._id],
});

const createApp = (agent, csrfToken, overrides = {}) => agent
  .post('/api/integrations/apps')
  .set('X-CSRF-Token', csrfToken)
  .send({
    name: 'Deploy Relay',
    description: 'Sends deployment events into Chatify',
    type: 'integration',
    allowedScopes: [INTEGRATION_SCOPES.CHANNELS_READ, INTEGRATION_SCOPES.WEBHOOKS_SEND],
    ...overrides,
  });

const installApp = (agent, csrfToken, appId, payload) => agent
  .post(`/api/integrations/apps/${appId}/installations`)
  .set('X-CSRF-Token', csrfToken)
  .send(payload);

describe('integration permission runtime', () => {
  it('registers, installs, rotates, revokes, and audits a scoped runtime token', async () => {
    const owner = await setupUser({
      firstName: 'Integration',
      lastName: 'Owner',
      username: 'integration.owner',
      email: 'integration-owner@example.test',
    });
    const member = await setupUser({
      firstName: 'Integration',
      lastName: 'Member',
      username: 'integration.member',
      email: 'integration-member@example.test',
    });
    const space = await createSpace(owner, member);
    const appResponse = await createApp(owner.agent, owner.csrfToken).expect(201);
    const appId = appResponse.body.data.app._id;

    const installResponse = await installApp(owner.agent, owner.csrfToken, appId, {
      targetType: 'space',
      targetId: space._id.toString(),
      scopes: [INTEGRATION_SCOPES.CHANNELS_READ],
    }).expect(201);
    const { installation, runtimeToken } = installResponse.body.data;
    const storedInstallation = await IntegrationInstallation.findById(installation._id)
      .select('+tokenHash')
      .lean();

    expect(runtimeToken).toMatch(/^chatify_it_/);
    expect(JSON.stringify(storedInstallation)).not.toContain(runtimeToken);

    const manifestResponse = await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${runtimeToken}`)
      .expect(200);

    expect(manifestResponse.body.data.manifest).toMatchObject({
      installationId: installation._id,
      app: {
        name: 'Deploy Relay',
        type: 'integration',
      },
      target: {
        type: 'space',
        id: space._id.toString(),
      },
      scopes: [INTEGRATION_SCOPES.CHANNELS_READ],
      status: 'active',
    });

    const rotateResponse = await owner.agent
      .post(`/api/integrations/installations/${installation._id}/rotate-token`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({})
      .expect(200);
    const rotatedToken = rotateResponse.body.data.runtimeToken;

    expect(rotatedToken).not.toBe(runtimeToken);
    await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${runtimeToken}`)
      .expect(401);
    await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${rotatedToken}`)
      .expect(200);

    await owner.agent
      .post(`/api/integrations/installations/${installation._id}/revoke`)
      .set('X-CSRF-Token', owner.csrfToken)
      .send({})
      .expect(200);
    await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${rotatedToken}`)
      .expect(403);

    const audits = await IntegrationAuditLog.find({}).lean();
    const auditText = JSON.stringify(audits);

    expect(audits.map((audit) => audit.action)).toEqual(expect.arrayContaining([
      INTEGRATION_AUDIT_ACTIONS.APP_CREATED,
      INTEGRATION_AUDIT_ACTIONS.INSTALLED,
      INTEGRATION_AUDIT_ACTIONS.RUNTIME_MANIFEST_READ,
      INTEGRATION_AUDIT_ACTIONS.TOKEN_ROTATED,
      INTEGRATION_AUDIT_ACTIONS.REVOKED,
      INTEGRATION_AUDIT_ACTIONS.RUNTIME_DENIED,
    ]));
    expect(auditText).not.toContain(runtimeToken);
    expect(auditText).not.toContain(rotatedToken);
    expect(auditText).not.toContain(owner.user.email);
  });

  it('rejects invalid scopes and unauthorized targets', async () => {
    const owner = await setupUser({
      firstName: 'Integration',
      lastName: 'Scope',
      username: 'integration.scope',
      email: 'integration-scope@example.test',
    });
    const member = await setupUser({
      firstName: 'Integration',
      lastName: 'Target',
      username: 'integration.target',
      email: 'integration-target@example.test',
    });
    const third = await setupUser({
      firstName: 'Integration',
      lastName: 'Third',
      username: 'integration.third',
      email: 'integration-third@example.test',
    });
    const space = await createSpace(owner, member);
    const group = await createGroupChat(owner, member, third);
    const appResponse = await createApp(owner.agent, owner.csrfToken, {
      allowedScopes: [INTEGRATION_SCOPES.CHANNELS_READ],
    }).expect(201);
    const appId = appResponse.body.data.app._id;

    await installApp(owner.agent, owner.csrfToken, appId, {
      targetType: 'space',
      targetId: space._id.toString(),
      scopes: [INTEGRATION_SCOPES.MESSAGES_WRITE],
    }).expect(403);

    await installApp(member.agent, member.csrfToken, appId, {
      targetType: 'space',
      targetId: space._id.toString(),
      scopes: [INTEGRATION_SCOPES.CHANNELS_READ],
    }).expect(404);

    await installApp(owner.agent, owner.csrfToken, appId, {
      targetType: 'chat',
      targetId: group._id.toString(),
      scopes: ['not:a-scope'],
    }).expect(400);
  });
});

describe('admin integration diagnostics', () => {
  it('requires admin access and returns aggregate integration runtime state', async () => {
    await request(app)
      .get('/api/admin/integrations')
      .expect(401);

    const admin = await setupUser({
      firstName: 'Integration',
      lastName: 'Admin',
      username: 'integration.admin',
      email: 'integration-admin@example.test',
    });
    const owner = await setupUser({
      firstName: 'Integration',
      lastName: 'Diagnostics',
      username: 'integration.diagnostics',
      email: 'integration-diagnostics@example.test',
    });
    const member = await setupUser({
      firstName: 'Integration',
      lastName: 'Diagnostic Peer',
      username: 'integration.diag.peer',
      email: 'integration-diagnostics-peer@example.test',
    });
    await User.findByIdAndUpdate(admin.user._id, { role: 'admin' });
    const space = await createSpace(owner, member);
    const appResponse = await createApp(owner.agent, owner.csrfToken, {
      name: 'Audit Relay',
      allowedScopes: [INTEGRATION_SCOPES.CHANNELS_READ, INTEGRATION_SCOPES.WEBHOOKS_SEND],
    }).expect(201);
    const appId = appResponse.body.data.app._id;
    const installResponse = await installApp(owner.agent, owner.csrfToken, appId, {
      targetType: 'space',
      targetId: space._id.toString(),
      scopes: [INTEGRATION_SCOPES.CHANNELS_READ, INTEGRATION_SCOPES.WEBHOOKS_SEND],
    }).expect(201);

    await request(app)
      .get('/api/integrations/runtime/manifest')
      .set('Authorization', `Bearer ${installResponse.body.data.runtimeToken}`)
      .expect(200);

    const response = await admin.agent
      .get('/api/admin/integrations')
      .expect(200);
    const payload = response.body.data.integrations;
    const serialized = JSON.stringify(response.body);

    expect(payload).toMatchObject({
      status: 'ok',
      apps: {
        total: 1,
        active: 1,
      },
      installations: {
        active: 1,
        revoked: 0,
      },
      runtime: {
        manifestReads: 1,
        deniedAccess: 0,
      },
    });
    expect(payload.scopes[INTEGRATION_SCOPES.CHANNELS_READ]).toBe(1);
    expect(payload.scopes[INTEGRATION_SCOPES.WEBHOOKS_SEND]).toBe(1);
    expect(serialized).not.toContain(installResponse.body.data.runtimeToken);
    expect(serialized).not.toContain(owner.user.email);
  });
});
