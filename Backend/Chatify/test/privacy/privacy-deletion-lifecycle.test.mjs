import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import IntegrationApp, {
  INTEGRATION_APP_STATUSES,
} from '../../Models/integrationAppModel.mjs';
import IntegrationInstallation, {
  INTEGRATION_INSTALLATION_STATUSES,
  INTEGRATION_INSTALLATION_TARGETS,
} from '../../Models/integrationInstallationModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../../Models/privacyRequestModel.mjs';
import Spaces, { SPACE_ROLES } from '../../Models/spaceModel.mjs';
import User from '../../Models/userModel.mjs';
import { deleteProfileImageFile } from '../../Services/profileImageStorageService.mjs';
import { processPrivacyOperations } from '../../Services/privacyOperationsService.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Services/profileImageStorageService.mjs', () => ({
  deleteProfileImageFile: vi.fn(),
}));

vi.mock('../../Config/socket.mjs', () => ({
  disconnectUserSockets: vi.fn(() => 0),
  emitToUserSockets: vi.fn(),
  joinUserToChat: vi.fn(),
  removeUserFromChat: vi.fn(),
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({ emit: vi.fn() })),
  })),
}));

const now = new Date('2026-07-01T09:00:00.000Z');

const createDeletionRequest = (userId) => PrivacyRequest.create({
  user: userId,
  type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
  status: PRIVACY_REQUEST_STATUSES.PENDING,
  requestedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
  scheduledFor: new Date(now.getTime() - 60 * 60 * 1000),
  events: [{
    action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
    actor: userId,
    metadata: {},
  }],
});

describe('account deletion lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteProfileImageFile.mockResolvedValue(undefined);
  });

  it('revokes integration authority and transfers owned collaboration targets', async () => {
    const owner = await signupWithAgent({
      firstName: 'Delete',
      lastName: 'Owner',
      username: 'delete.owner',
      email: 'delete-owner@example.test',
    });
    const successor = await signupWithAgent({
      firstName: 'Delete',
      lastName: 'Successor',
      username: 'delete.successor',
      email: 'delete-successor@example.test',
    });
    const third = await signupWithAgent({
      firstName: 'Delete',
      lastName: 'Third',
      username: 'delete.third',
      email: 'delete-third@example.test',
    });
    const space = await Spaces.create({
      name: 'Deletion transfer space',
      owner: owner.user._id,
      createdBy: owner.user._id,
      joinCode: 'DEL12345',
      members: [
        { user: owner.user._id, role: SPACE_ROLES.OWNER },
        { user: successor.user._id, role: SPACE_ROLES.ADMIN },
      ],
    });
    const group = await Chats.create({
      chatName: 'Deletion transfer group',
      isGroupChat: true,
      groupAdmin: owner.user._id,
      members: [owner.user._id, successor.user._id, third.user._id],
    });
    const app = await IntegrationApp.create({
      owner: owner.user._id,
      name: 'Deletion integration',
      allowedScopes: ['channels:read'],
    });
    const installation = await IntegrationInstallation.create({
      app: app._id,
      installedBy: owner.user._id,
      targetType: INTEGRATION_INSTALLATION_TARGETS.SPACE,
      targetId: space._id,
      scopes: ['channels:read'],
      tokenHash: 'privacy-deletion-integration-token-hash',
    });
    await createDeletionRequest(owner.user._id);

    const result = await processPrivacyOperations({ now, recordRun: false });
    const storedSpace = await Spaces.findById(space._id).lean();
    const storedGroup = await Chats.findById(group._id).lean();
    const storedApp = await IntegrationApp.findById(app._id).lean();
    const storedInstallation = await IntegrationInstallation.findById(installation._id).lean();

    expect(result.counts).toMatchObject({
      integrationAppsRevoked: 1,
      integrationInstallationsRevoked: 1,
      spacesTransferred: 1,
      spaceMembershipsRemoved: 1,
      groupAdminsTransferred: 1,
      errors: 0,
    });
    expect(storedSpace.owner.toString()).toBe(successor.user._id.toString());
    expect(storedSpace.members.map((member) => member.user.toString())).not.toContain(
      owner.user._id.toString()
    );
    expect(storedSpace.members.find(
      (member) => member.user.toString() === successor.user._id.toString()
    )?.role).toBe(SPACE_ROLES.OWNER);
    expect(storedGroup.groupAdmin.toString()).toBe(successor.user._id.toString());
    expect(storedApp.status).toBe(INTEGRATION_APP_STATUSES.REVOKED);
    expect(storedInstallation.status).toBe(INTEGRATION_INSTALLATION_STATUSES.REVOKED);
    expect(storedInstallation.revokedAt).toBeTruthy();
  });

  it('keeps a request cleanup-pending until physical profile deletion succeeds', async () => {
    const owner = await signupWithAgent({
      firstName: 'Delete',
      lastName: 'Cleanup',
      username: 'delete.cleanup',
      email: 'delete-cleanup@example.test',
    });
    const storageFileId = new mongoose.Types.ObjectId();
    await User.updateOne(
      { _id: owner.user._id },
      {
        $set: {
          uploadedProfileImage: {
            storageFileId,
            mimeType: 'image/png',
            size: 128,
            version: 'cleanup-test',
            updatedAt: now,
          },
          profilePic: `/api/user/${owner.user._id}/profile-image?v=cleanup-test`,
        },
      }
    );
    const request = await createDeletionRequest(owner.user._id);
    deleteProfileImageFile.mockRejectedValueOnce(new Error('provider token secret failure'));

    const failedRun = await processPrivacyOperations({ now, recordRun: false });
    const cleanupPending = await PrivacyRequest.findById(request._id)
      .select('+cleanup.processingToken')
      .lean();
    const anonymized = await User.findById(owner.user._id).lean();

    expect(failedRun.status).toBe('failed');
    expect(failedRun.counts).toMatchObject({
      deletionRequestsProcessed: 1,
      accountsAnonymized: 1,
      cleanupPending: 1,
      cleanupRetried: 1,
      profileImagesDeleted: 0,
      errors: 1,
    });
    expect(cleanupPending.status).toBe(PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING);
    expect(cleanupPending.completedAt).toBeFalsy();
    expect(cleanupPending.cleanup).toMatchObject({
      profileImageStorageId: storageFileId,
      attempts: 1,
    });
    expect(cleanupPending.cleanup.lastError).not.toContain('provider token secret failure');
    expect(anonymized.email).toBe(`deleted-${owner.user._id}@chatify.invalid`);

    deleteProfileImageFile.mockResolvedValueOnce(undefined);
    const successfulRun = await processPrivacyOperations({
      now: new Date(now.getTime() + 60_000),
      recordRun: false,
    });
    const completed = await PrivacyRequest.findById(request._id).lean();

    expect(successfulRun.status).toBe('completed');
    expect(successfulRun.counts).toMatchObject({
      deletionRequestsProcessed: 0,
      cleanupRetried: 1,
      cleanupCompleted: 1,
      profileImagesDeleted: 1,
      errors: 0,
    });
    expect(completed.status).toBe(PRIVACY_REQUEST_STATUSES.COMPLETED);
    expect(completed.completedAt).toBeTruthy();
    expect(completed.cleanup).toBeUndefined();
    expect(completed.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: PRIVACY_REQUEST_ACTIONS.DELETION_CLEANUP_COMPLETED,
      }),
    ]));
    expect(deleteProfileImageFile).toHaveBeenCalledTimes(2);
  });
});
