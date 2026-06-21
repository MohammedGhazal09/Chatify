import { describe, expect, it } from 'vitest';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../../Models/privacyRequestModel.mjs';
import User from '../../Models/userModel.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

const setupUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

const requestDeletion = (agent, csrfToken) => agent
  .post('/api/user/privacy/deletion-request')
  .set('X-CSRF-Token', csrfToken)
  .send({});

const cancelDeletion = (agent, csrfToken) => agent
  .post('/api/user/privacy/deletion-request/cancel')
  .set('X-CSRF-Token', csrfToken)
  .send({});

describe('user privacy deletion request', () => {
  it('creates one reversible pending deletion request without deleting the account', async () => {
    const owner = await setupUser({ firstName: 'Deletion', lastName: 'Owner' });

    const first = await requestDeletion(owner.agent, owner.csrfToken).expect(201);
    const second = await requestDeletion(owner.agent, owner.csrfToken).expect(200);
    const storedUser = await User.findById(owner.user._id).lean();
    const requests = await PrivacyRequest.find({
      user: owner.user._id,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
    }).lean();

    expect(first.body.data.deletionRequest).toMatchObject({
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      retentionSummary: expect.objectContaining({
        accountProfile: expect.stringContaining('anonymization'),
        moderation: expect.stringContaining('retained'),
      }),
    });
    expect(second.body.data.deletionRequest._id).toBe(first.body.data.deletionRequest._id);
    expect(storedUser).toBeTruthy();
    expect(requests).toHaveLength(1);
    expect(requests[0].events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
        }),
      ])
    );
    expect(JSON.stringify(requests[0])).not.toContain(owner.user.email);
  });

  it('cancels only the requester pending deletion request', async () => {
    const owner = await setupUser({ firstName: 'Deletion', lastName: 'Cancel' });
    const other = await setupUser({ firstName: 'Deletion', lastName: 'Other' });

    await requestDeletion(owner.agent, owner.csrfToken).expect(201);
    await cancelDeletion(other.agent, other.csrfToken).expect(404);
    const response = await cancelDeletion(owner.agent, owner.csrfToken).expect(200);
    const pending = await PrivacyRequest.findOne({
      user: owner.user._id,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.PENDING,
    }).lean();

    expect(response.body.data.deletionRequest).toMatchObject({
      status: PRIVACY_REQUEST_STATUSES.CANCELED,
    });
    expect(pending).toBeNull();
  });

  it('requires CSRF for deletion request and cancellation actions', async () => {
    const owner = await setupUser({ firstName: 'Deletion', lastName: 'Csrf' });

    await owner.agent
      .post('/api/user/privacy/deletion-request')
      .send({})
      .expect(403);

    await owner.agent
      .post('/api/user/privacy/deletion-request/cancel')
      .send({})
      .expect(403);
  });
});
