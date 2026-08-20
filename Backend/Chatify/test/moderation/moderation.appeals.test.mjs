import { describe, expect, it } from "vitest";
import AbuseReport from "../../Models/abuseReportModel.mjs";
import User from "../../Models/userModel.mjs";
import { createDirectChat } from "../fixtures/chats.mjs";
import { createMessage } from "../fixtures/messages.mjs";
import { signupWithAgent } from "../helpers/authAgent.mjs";

const setupDirectReportScenario = async () => {
  const reporter = await signupWithAgent({
    firstName: "Appeal",
    lastName: "Reporter",
    username: "appeal.reporter",
    email: "appeal-reporter@example.test",
  });
  const peer = await signupWithAgent({
    firstName: "Appeal",
    lastName: "Peer",
    username: "appeal.peer",
    email: "appeal-peer@example.test",
  });
  const admin = await signupWithAgent({
    firstName: "Appeal",
    lastName: "Admin",
    username: "appeal.admin",
    email: "appeal-admin@example.test",
  });
  const adminTwo = await signupWithAgent({
    firstName: "Appeal",
    lastName: "Reviewer",
    username: "appeal.reviewer",
    email: "appeal-reviewer@example.test",
  });
  await User.findByIdAndUpdate(admin.user._id, { role: "admin" });
  await User.findByIdAndUpdate(adminTwo.user._id, { role: "admin" });
  const chat = await createDirectChat([reporter.user, peer.user]);
  const message = await createMessage({
    chat,
    sender: peer.user,
    text: "Appealable content with reporter@example.test and token=secret-value",
  });

  return { reporter, peer, admin, adminTwo, chat, message };
};

const createRestrictedReport = async ({ reporter, admin, message }) => {
  const createResponse = await reporter.agent
    .post("/api/moderation/reports")
    .send({
      targetType: "message",
      messageId: message._id.toString(),
      reason: "privacy",
      details: "Appeal report details include reporter@example.test",
    })
    .expect(201);

  const reviewResponse = await admin.agent
    .patch(`/api/moderation/reports/${createResponse.body.data.report._id}/review`)
    .send({
      status: "action_taken",
      moderationAction: "restricted",
      note: "Restrict after appeal setup. secret=admin-token",
    })
    .expect(200);

  return reviewResponse.body.data.report;
};

describe("moderation appeals and reviewer operations", () => {
  it("lets only the enforced user view and appeal their own enforcement", async () => {
    const scenario = await setupDirectReportScenario();
    const report = await createRestrictedReport(scenario);

    const ownerEnforcements = await scenario.peer.agent
      .get("/api/moderation/my-enforcements")
      .expect(200);
    const reporterEnforcements = await scenario.reporter.agent
      .get("/api/moderation/my-enforcements")
      .expect(200);
    const serializedOwnerView = JSON.stringify(ownerEnforcements.body);

    expect(ownerEnforcements.body.data.enforcements).toEqual([
      expect.objectContaining({
        _id: report._id,
        moderationAction: "restricted",
        canAppeal: true,
      }),
    ]);
    expect(reporterEnforcements.body.data.enforcements).toEqual([]);
    expect(serializedOwnerView).not.toContain(scenario.reporter.user.email);
    expect(serializedOwnerView).not.toContain("Appeal report details");

    const appealResponse = await scenario.peer.agent
      .post(`/api/moderation/reports/${report._id}/appeal`)
      .send({
        reason: "I want this reviewed. email appeal-peer@example.test token=appeal-secret",
      })
      .expect(201);

    expect(appealResponse.body.data.appeal).toMatchObject({
      status: "open",
      reason: expect.stringContaining("[redacted-email]"),
    });
    expect(appealResponse.body.data.appeal.reason).toContain("token=[redacted]");

    await scenario.peer.agent
      .post(`/api/moderation/reports/${report._id}/appeal`)
      .send({ reason: "second appeal" })
      .expect(409);

    await scenario.reporter.agent
      .post(`/api/moderation/reports/${report._id}/appeal`)
      .send({ reason: "not my enforcement" })
      .expect(404);
  });

  it("lets admins assign work, inspect count-only ops, view history, and resolve appeals", async () => {
    const scenario = await setupDirectReportScenario();
    const report = await createRestrictedReport(scenario);
    const appealResponse = await scenario.peer.agent
      .post(`/api/moderation/reports/${report._id}/appeal`)
      .send({ reason: "Please review the restriction." })
      .expect(201);

    const assigned = await scenario.admin.agent
      .patch(`/api/moderation/reports/${report._id}/assign`)
      .send({ assignedTo: scenario.adminTwo.user._id.toString() })
      .expect(200);

    expect(assigned.body.data.report).toMatchObject({
      assignedTo: scenario.adminTwo.user._id.toString(),
      assignedToIdentity: expect.objectContaining({
        username: "appeal.reviewer",
      }),
    });
    expect(assigned.body.data.report.assignmentHistory).toHaveLength(1);

    const summary = await scenario.admin.agent
      .get("/api/moderation/ops-summary")
      .expect(200);
    const serializedSummary = JSON.stringify(summary.body);

    expect(summary.body.data.summary).toMatchObject({
      reportsByStatus: expect.objectContaining({ action_taken: 1 }),
      appealsByStatus: expect.objectContaining({ open: 1 }),
      unassignedOpen: 0,
    });
    expect(serializedSummary).not.toContain(scenario.reporter.user.email);
    expect(serializedSummary).not.toContain("Appealable content");

    const history = await scenario.admin.agent
      .get(`/api/moderation/users/${scenario.peer.user._id}/enforcement-history`)
      .expect(200);

    expect(history.body.data.history).toEqual([
      expect.objectContaining({
        _id: report._id,
        moderationAction: "restricted",
        appeals: expect.arrayContaining([
          expect.objectContaining({ status: "open" }),
        ]),
      }),
    ]);

    const resolved = await scenario.admin.agent
      .patch(`/api/moderation/reports/${report._id}/appeals/${appealResponse.body.data.appeal._id}`)
      .send({
        status: "accepted",
        reviewerNote: "Accepted after review. secret=appeal-review-token",
      })
      .expect(200);

    expect(resolved.body.data.appeal).toMatchObject({
      status: "accepted",
      reviewerNote: expect.stringContaining("secret=[redacted]"),
      reviewedBy: scenario.admin.user._id.toString(),
    });
    expect(resolved.body.data.report.auditTrail.at(-1)).toMatchObject({
      moderationAction: "restricted",
      note: expect.stringContaining("Appeal accepted"),
    });

    const stored = await AbuseReport.findById(report._id).lean();
    expect(stored.appeals[0].status).toBe("accepted");
  });

  it("blocks non-admin access to operations endpoints", async () => {
    const scenario = await setupDirectReportScenario();

    await scenario.peer.agent
      .get("/api/moderation/ops-summary")
      .expect(403);

    await scenario.peer.agent
      .get(`/api/moderation/users/${scenario.peer.user._id}/enforcement-history`)
      .expect(403);
  });
});
