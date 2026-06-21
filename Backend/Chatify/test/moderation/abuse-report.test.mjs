import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.mjs";
import AbuseReport from "../../Models/abuseReportModel.mjs";
import Message from "../../Models/messageModel.mjs";
import User from "../../Models/userModel.mjs";
import { createDirectChat } from "../fixtures/chats.mjs";
import { createMessage } from "../fixtures/messages.mjs";
import { getCsrfForAgent, signupWithAgent } from "../helpers/authAgent.mjs";

const setupDirectReportScenario = async () => {
  const reporter = await signupWithAgent({
    firstName: "Report",
    lastName: "Sender",
    username: "report.sender",
    email: "report-sender@example.test",
  });
  const peer = await signupWithAgent({
    firstName: "Report",
    lastName: "Peer",
    username: "report.peer",
    email: "report-peer@example.test",
  });
  const chat = await createDirectChat([reporter.user, peer.user]);
  const message = await createMessage({
    chat,
    sender: peer.user,
    text: "This includes peer@example.test and Bearer abcdefghijklmnopqrstuvwxyz1234567890",
  });

  return { reporter, peer, chat, message };
};

describe("abuse reporting and moderation review", () => {
  it("allows a member to report a visible message with redacted context", async () => {
    const { reporter, peer, message } = await setupDirectReportScenario();

    const response = await reporter.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "harassment",
        details: "Please review token=secret-value and reporter@example.test",
      })
      .expect(201);

    const serialized = JSON.stringify(response.body);
    expect(response.body.data.report).toMatchObject({
      targetType: "message",
      reportedUser: peer.user._id.toString(),
      message: message._id.toString(),
      reason: "harassment",
      status: "open",
    });
    expect(response.body.data.report.context.message.textPreview).toContain("[redacted-email]");
    expect(response.body.data.report.context.message.textPreview).toContain("Bearer [redacted-token]");
    expect(response.body.data.report.details).toContain("[redacted-email]");
    expect(serialized).not.toContain(reporter.user.email);
    expect(serialized).not.toContain(peer.user.email);
  });

  it("hides message reports from users outside the conversation", async () => {
    const { message } = await setupDirectReportScenario();
    const outsider = await signupWithAgent({
      firstName: "Report",
      lastName: "Outsider",
      username: "report.outsider",
    });

    await outsider.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "spam",
      })
      .expect(404);
  });

  it("adds privacy-safe space channel context to report snapshots", async () => {
    const owner = await signupWithAgent({
      firstName: "Space",
      lastName: "ReporterOwner",
      username: "space.report.owner",
      email: "space-report-owner@example.test",
    });
    const member = await signupWithAgent({
      firstName: "Space",
      lastName: "ReporterMember",
      username: "space.report.member",
      email: "space-report-member@example.test",
    });
    const created = await owner.agent
      .post("/api/space")
      .send({
        name: "Moderation Space",
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;
    const channelId = created.body.data.channel._id;
    const messageResponse = await owner.agent
      .post("/api/message/new-message")
      .send({
        chatId: channelId,
        text: "Channel report context includes owner@example.test",
        clientMessageId: "space-report-message-1",
      })
      .expect(201);

    const response = await member.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: messageResponse.body.data.message._id,
        reason: "privacy",
      })
      .expect(201);
    const serialized = JSON.stringify(response.body);

    expect(response.body.data.report.context.chat).toMatchObject({
      chatId: channelId,
      isGroupChat: true,
      isSpaceChannel: true,
      spaceId,
      channelId,
      channelName: "general",
      memberCount: 2,
    });
    expect(response.body.data.report.context.message.textPreview).toContain("[redacted-email]");
    expect(serialized).not.toContain(owner.user.email);
    expect(serialized).not.toContain(member.user.email);
  });

  it("requires CSRF protection on unsafe report creation", async () => {
    const { reporter, message } = await setupDirectReportScenario();
    const csrfToken = await getCsrfForAgent(reporter.agent);

    const noCsrfAgent = await signupWithAgent({
      firstName: "No",
      lastName: "Csrf",
      username: "report.nocsrf",
    }, { autoCsrf: false });

    await noCsrfAgent.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "spam",
      })
      .expect(403);

    await reporter.agent
      .post("/api/moderation/reports")
      .set("X-CSRF-Token", csrfToken)
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "spam",
      })
      .expect(201);
  });

  it("prevents normal users from listing, reading, or reviewing reports", async () => {
    const { reporter, message } = await setupDirectReportScenario();
    const createResponse = await reporter.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "privacy",
      })
      .expect(201);

    await reporter.agent
      .get("/api/moderation/reports")
      .expect(403);

    await reporter.agent
      .get(`/api/moderation/reports/${createResponse.body.data.report._id}`)
      .expect(403);

    await reporter.agent
      .patch(`/api/moderation/reports/${createResponse.body.data.report._id}/review`)
      .send({
        status: "reviewed",
        moderationAction: "none",
      })
      .expect(403);
  });

  it("allows admins to review reports, restrict messaging, and lift restrictions", async () => {
    const { reporter, peer, chat, message } = await setupDirectReportScenario();
    const admin = await signupWithAgent({
      firstName: "Report",
      lastName: "Admin",
      username: "report.admin",
    });
    await User.findByIdAndUpdate(admin.user._id, { role: "admin" });

    const createResponse = await reporter.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "illegal",
      })
      .expect(201);

    const listResponse = await admin.agent
      .get("/api/moderation/reports")
      .expect(200);

    expect(listResponse.body.data.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: createResponse.body.data.report._id,
          priority: "high",
          reporterIdentity: expect.objectContaining({ displayName: "Report Sender" }),
          reportedUserIdentity: expect.objectContaining({ displayName: "Report Peer" }),
        }),
      ])
    );

    const detailResponse = await admin.agent
      .get(`/api/moderation/reports/${createResponse.body.data.report._id}`)
      .expect(200);
    const serializedDetail = JSON.stringify(detailResponse.body);
    expect(detailResponse.body.data.report.context.message.textPreview).toContain("Bearer [redacted-token]");
    expect(serializedDetail).not.toContain(reporter.user.email);
    expect(serializedDetail).not.toContain(peer.user.email);

    const reviewResponse = await admin.agent
      .patch(`/api/moderation/reports/${createResponse.body.data.report._id}/review`)
      .send({
        status: "action_taken",
        moderationAction: "restricted",
        note: "Restricted after review. secret=internal-token",
      })
      .expect(200);

    expect(reviewResponse.body.data.report).toMatchObject({
      status: "action_taken",
      moderationAction: "restricted",
      reviewedBy: admin.user._id.toString(),
    });
    expect(reviewResponse.body.data.report.moderationNote).toContain("secret=[redacted]");
    expect(reviewResponse.body.data.report.auditTrail).toHaveLength(1);
    expect(reviewResponse.body.data.report.auditTrail[0]).toMatchObject({
      actor: admin.user._id.toString(),
      status: "action_taken",
      moderationAction: "restricted",
    });
    expect(reviewResponse.body.data.report.enforcement).toMatchObject({
      action: "restricted",
      targetType: "user",
      targetId: peer.user._id.toString(),
      appliedBy: admin.user._id.toString(),
    });
    expect(reviewResponse.body.data.report.enforcement.expiresAt).toBeTruthy();

    const restrictedPeer = await User.findById(peer.user._id).select("+moderation");
    expect(restrictedPeer.moderation.messagingRestrictedUntil).toBeInstanceOf(Date);

    const blockedSend = await peer.agent
      .post("/api/message/new-message")
      .send({
        chatId: chat._id.toString(),
        text: "This should be blocked by moderation.",
        clientMessageId: "moderation-restricted-send",
      })
      .expect(403);
    expect(blockedSend.body).toMatchObject({
      code: "moderation_restricted",
      message: "Messaging is temporarily restricted after moderation review.",
    });

    const liftResponse = await admin.agent
      .patch(`/api/moderation/reports/${createResponse.body.data.report._id}/review`)
      .send({
        status: "action_taken",
        moderationAction: "restriction_lifted",
        note: "Restriction lifted after second review.",
      })
      .expect(200);

    expect(liftResponse.body.data.report.auditTrail).toHaveLength(2);
    expect(liftResponse.body.data.report.enforcement).toMatchObject({
      action: "restriction_lifted",
      targetType: "user",
      targetId: peer.user._id.toString(),
    });

    const liftedPeer = await User.findById(peer.user._id).select("+moderation");
    expect(liftedPeer.moderation.messagingRestrictedUntil).toBeUndefined();

    await peer.agent
      .post("/api/message/new-message")
      .send({
        chatId: chat._id.toString(),
        text: "Messaging works again.",
        clientMessageId: "moderation-restriction-lifted-send",
      })
      .expect(201);
  });

  it("allows admins to remove reported message content", async () => {
    const { reporter, message } = await setupDirectReportScenario();
    const admin = await signupWithAgent({
      firstName: "Content",
      lastName: "Admin",
      username: "content.admin",
    });
    await User.findByIdAndUpdate(admin.user._id, { role: "admin" });

    const createResponse = await reporter.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "message",
        messageId: message._id.toString(),
        reason: "privacy",
      })
      .expect(201);

    const reviewResponse = await admin.agent
      .patch(`/api/moderation/reports/${createResponse.body.data.report._id}/review`)
      .send({
        status: "action_taken",
        moderationAction: "content_removed",
        note: "Remove the reported message preview.",
      })
      .expect(200);

    expect(reviewResponse.body.data.report.enforcement).toMatchObject({
      action: "content_removed",
      targetType: "message",
      targetId: message._id.toString(),
    });

    const removedMessage = await Message.findById(message._id);
    expect(removedMessage.deletedForEveryone).toBe(true);
    expect(removedMessage.text).toBe("");
  });

  it("supports direct user reports and rejects self-reporting", async () => {
    const { reporter, peer, chat } = await setupDirectReportScenario();

    const userReport = await reporter.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "user",
        chatId: chat._id.toString(),
        reportedUserId: peer.user._id.toString(),
        reason: "impersonation",
      })
      .expect(201);

    expect(userReport.body.data.report).toMatchObject({
      targetType: "user",
      reportedUser: peer.user._id.toString(),
      chat: chat._id.toString(),
    });

    await reporter.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "user",
        chatId: chat._id.toString(),
        reportedUserId: reporter.user._id.toString(),
        reason: "other",
      })
      .expect(400);

    await expect(AbuseReport.countDocuments({ targetType: "user" })).resolves.toBe(1);
  });

  it("rejects unauthenticated report reads", async () => {
    await request(app)
      .get("/api/moderation/reports")
      .expect(401);
  });
});
