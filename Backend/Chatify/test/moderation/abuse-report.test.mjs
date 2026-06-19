import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.mjs";
import AbuseReport from "../../Models/abuseReportModel.mjs";
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

  it("prevents normal users from listing or reviewing reports", async () => {
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
      .patch(`/api/moderation/reports/${createResponse.body.data.report._id}/review`)
      .send({
        status: "reviewed",
        moderationAction: "none",
      })
      .expect(403);
  });

  it("allows admins to review reports and records an audit entry", async () => {
    const { reporter, message } = await setupDirectReportScenario();
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
        expect.objectContaining({ _id: createResponse.body.data.report._id }),
      ])
    );

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
