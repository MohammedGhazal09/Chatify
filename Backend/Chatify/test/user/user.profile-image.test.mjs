import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import User from '../../Models/userModel.mjs';
import { getProfileImageBucket } from '../../Services/profileImageStorageService.mjs';
import { profileImageUploadLimiter } from '../../Middlewares/rateLimiters.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { tinyPdfBuffer } from '../fixtures/attachments.mjs';
import {
  attachProfileImage,
  oversizedProfileImageBuffer,
  profileImageCases,
  tinyExecutableBuffer,
  tinyGifBuffer,
  tinyPngBuffer,
  tinyWebpBuffer,
} from '../fixtures/profileImages.mjs';
import { createAgent, getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const uploadProfileImage = (agent, csrfToken, image = {}) => attachProfileImage(
  agent
    .patch('/api/user/profile-image')
    .set('X-CSRF-Token', csrfToken),
  image
);

const removeProfileImage = (agent, csrfToken) => agent
  .delete('/api/user/profile-image')
  .set('X-CSRF-Token', csrfToken);

const expectNoPrivateProfileImageFields = (payload) => {
  expect(JSON.stringify(payload)).not.toMatch(
    /uploadedProfileImage|storageFileId|bucket|objectKey|sha256|hash|private path|token|cookie/i
  );
};

const setupProfileImageUser = async (overrides = {}) => {
  const signedUp = await signupWithAgent(overrides);
  const csrfToken = await getCsrfForAgent(signedUp.agent);
  return { ...signedUp, csrfToken };
};

describe('user profile images', () => {
  it('ignores client-supplied profilePic during local signup', async () => {
    const { user } = await signupWithAgent({
      firstName: 'Local',
      lastName: 'Signup',
      profilePic: 'https://attacker.example/avatar.png',
    });

    expect(user.profilePic).toBe('');
    expect(user.uploadedProfileImage).toBeUndefined();
  });

  it.each(profileImageCases)('accepts valid $name profile images with safe payloads', async (imageCase) => {
    const { agent, csrfToken, user } = await setupProfileImageUser({
      firstName: 'Valid',
      lastName: imageCase.name,
    });

    const response = await uploadProfileImage(agent, csrfToken, {
      filename: imageCase.filename,
      contentType: imageCase.contentType,
      buffer: imageCase.buffer(),
    }).expect(200);

    const profilePic = response.body.data.user.profilePic;

    expect(profilePic).toContain(`/api/user/${user._id.toString()}/profile-image?v=`);
    expectNoPrivateProfileImageFields(response.body);

    const preview = await agent
      .get(profilePic)
      .expect(200);

    expect(preview.headers['content-type']).toMatch(imageCase.contentType.replace('+', '\\+'));
  });

  it('rejects invalid profile image payloads without changing the current image', async () => {
    const { agent, csrfToken } = await setupProfileImageUser({
      firstName: 'Invalid',
      lastName: 'Payload',
    });
    const uploaded = await uploadProfileImage(agent, csrfToken).expect(200);
    const originalProfilePic = uploaded.body.data.user.profilePic;

    const invalidCases = [
      {
        name: 'empty',
        expectedCode: 'PROFILE_IMAGE_EMPTY',
        filename: 'empty.png',
        contentType: 'image/png',
        buffer: Buffer.alloc(0),
      },
      {
        name: 'oversized',
        expectedCode: 'PROFILE_IMAGE_SIZE_EXCEEDED',
        filename: 'large.png',
        contentType: 'image/png',
        buffer: oversizedProfileImageBuffer(),
      },
      {
        name: 'pdf',
        expectedCode: 'PROFILE_IMAGE_TYPE_UNSUPPORTED',
        filename: 'document.pdf',
        contentType: 'application/pdf',
        buffer: tinyPdfBuffer(),
      },
      {
        name: 'gif',
        expectedCode: 'PROFILE_IMAGE_TYPE_UNSUPPORTED',
        filename: 'animated.gif',
        contentType: 'image/gif',
        buffer: tinyGifBuffer(),
      },
      {
        name: 'executable',
        expectedCode: 'PROFILE_IMAGE_TYPE_UNSUPPORTED',
        filename: 'payload.exe',
        contentType: 'application/octet-stream',
        buffer: tinyExecutableBuffer(),
      },
      {
        name: 'mismatched content',
        expectedCode: 'PROFILE_IMAGE_TYPE_UNSUPPORTED',
        filename: 'mismatch.jpg',
        contentType: 'image/jpeg',
        buffer: tinyPngBuffer(),
      },
    ];

    for (const invalidCase of invalidCases) {
      const response = await uploadProfileImage(agent, csrfToken, invalidCase).expect(400);

      expect(response.body.code).toBe(invalidCase.expectedCode);

      const currentUser = await agent
        .get('/api/user/get-logged-user')
        .expect(200);

      expect(currentUser.body.user.profilePic).toBe(originalProfilePic);
    }
  });

  it('requires authentication and CSRF for profile image routes', async () => {
    const app = await getTestApp();
    const { agent, user } = await setupProfileImageUser({
      firstName: 'Secure',
      lastName: 'Routes',
    });

    await request(app)
      .get(`/api/user/${user._id.toString()}/profile-image`)
      .expect(401);

    await request(app)
      .delete('/api/user/profile-image')
      .expect(401);

    await attachProfileImage(
      request(app)
        .patch('/api/user/profile-image')
    ).expect(401);

    await attachProfileImage(
      agent.patch('/api/user/profile-image')
    ).expect(403);

    expect(profileImageUploadLimiter).toBeTypeOf('function');
  });

  it('replaces, removes, and falls back to provider image without serving old versions', async () => {
    const { agent, csrfToken, user } = await setupProfileImageUser({
      firstName: 'Lifecycle',
      lastName: 'User',
    });
    const providerUrl = 'https://provider.example/avatar.png';

    await User.findByIdAndUpdate(user._id, {
      profilePic: providerUrl,
      providerProfilePic: providerUrl,
    });

    const firstUpload = await uploadProfileImage(agent, csrfToken, {
      filename: 'first.png',
      contentType: 'image/png',
      buffer: tinyPngBuffer(),
    }).expect(200);
    const firstProfilePic = firstUpload.body.data.user.profilePic;

    const secondUpload = await uploadProfileImage(agent, csrfToken, {
      filename: 'second.webp',
      contentType: 'image/webp',
      buffer: tinyWebpBuffer(),
    }).expect(200);
    const secondProfilePic = secondUpload.body.data.user.profilePic;

    expect(secondProfilePic).not.toBe(firstProfilePic);
    await agent.get(firstProfilePic).expect(404);

    const storedFilesAfterReplace = await getProfileImageBucket()
      .find({ 'metadata.userId': user._id.toString() })
      .toArray();

    expect(storedFilesAfterReplace).toHaveLength(1);

    const removed = await removeProfileImage(agent, csrfToken).expect(200);

    expect(removed.body.data.user.profilePic).toBe(providerUrl);
    await agent.get(secondProfilePic).expect(404);

    const storedFilesAfterRemove = await getProfileImageBucket()
      .find({ 'metadata.userId': user._id.toString() })
      .toArray();

    expect(storedFilesAfterRemove).toHaveLength(0);
  });

  it('cleans up a new uploaded file when profile metadata persistence fails', async () => {
    const { agent, csrfToken, user } = await setupProfileImageUser({
      firstName: 'Cleanup',
      lastName: 'Failure',
    });
    const saveSpy = vi
      .spyOn(User.prototype, 'save')
      .mockRejectedValueOnce(new Error('profile metadata write failed'));

    try {
      await uploadProfileImage(agent, csrfToken).expect(500);
    } finally {
      saveSpy.mockRestore();
    }

    const storedFiles = await getProfileImageBucket()
      .find({ 'metadata.userId': user._id.toString() })
      .toArray();

    expect(storedFiles).toHaveLength(0);
  });

  it('exposes safe profile image references through authenticated identity surfaces', async () => {
    const owner = await setupProfileImageUser({
      firstName: 'Identity',
      lastName: 'Owner',
    });
    const viewer = await setupProfileImageUser({
      firstName: 'Identity',
      lastName: 'Viewer',
    });
    const upload = await uploadProfileImage(owner.agent, owner.csrfToken).expect(200);
    const profilePic = upload.body.data.user.profilePic;

    await createDirectChat([owner.user, viewer.user]);

    const loggedUser = await owner.agent
      .get('/api/user/get-logged-user')
      .expect(200);
    const allUsers = await viewer.agent
      .get('/api/user/get-all-users')
      .expect(200);
    const onlineUsers = await viewer.agent
      .get('/api/user/online-users')
      .expect(200);
    const chats = await viewer.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const ownerFromAllUsers = allUsers.body.users.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromContacts = onlineUsers.body.data.allContacts.find((candidate) => candidate._id === owner.user._id.toString());
    const ownerFromChat = chats.body.data.chats[0].members.find((candidate) => candidate._id === owner.user._id.toString());

    expect(loggedUser.body.user.profilePic).toBe(profilePic);
    expect(ownerFromAllUsers.profilePic).toBe(profilePic);
    expect(ownerFromContacts.profilePic).toBe(profilePic);
    expect(ownerFromChat.profilePic).toBe(profilePic);
    expectNoPrivateProfileImageFields(loggedUser.body);
    expectNoPrivateProfileImageFields(allUsers.body);
    expectNoPrivateProfileImageFields(onlineUsers.body);
    expectNoPrivateProfileImageFields(chats.body);
  });

  it('keeps uploaded image override when OAuth provider image changes', async () => {
    const { agent, csrfToken, user } = await setupProfileImageUser({
      firstName: 'OAuth',
      lastName: 'Override',
    });
    const upload = await uploadProfileImage(agent, csrfToken).expect(200);

    const loaded = await User.findById(user._id).select('+providerProfilePic +uploadedProfileImage');
    loaded.providerProfilePic = 'https://provider.example/new.png';

    if (!loaded.hasUploadedProfileImage()) {
      loaded.profilePic = loaded.providerProfilePic;
    }

    await loaded.save();

    const response = await agent
      .get('/api/user/get-logged-user')
      .expect(200);

    expect(response.body.user.profilePic).toBe(upload.body.data.user.profilePic);
  });
});
