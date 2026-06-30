import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.mjs";
import NotificationOutbox, {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_OUTBOX_STATUS,
} from "../../Models/notificationOutboxModel.mjs";
import User from "../../Models/userModel.mjs";
import { createDirectChat } from "../fixtures/chats.mjs";
import { createMessage } from "../fixtures/messages.mjs";
import { signupWithAgent } from "../helpers/authAgent.mjs";

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

const setupDeliveryHealthScenario = async () => {
  const admin = await signupWithAgent({
    firstName: "Delivery",
    lastName: "Admin",
    username: "delivery.admin",
    email: "delivery-admin@example.test",
  });
  const sender = await signupWithAgent({
    firstName: "Delivery",
    lastName: "Sender",
    username: "delivery.sender",
    email: "delivery-sender@example.test",
  });
  const recipient = await signupWithAgent({
    firstName: "Delivery",
    lastName: "Recipient",
    username: "delivery.recipient",
    email: "delivery-recipient@example.test",
  });
  await User.findByIdAndUpdate(admin.user._id, { role: "admin" });

  const chat = await createDirectChat([sender.user, recipient.user]);
  const staleSent = await createMessage({
    chat,
    sender: sender.user,
    text: "private delivery text should never leak",
    overrides: {
      status: "sent",
      createdAt: minutesAgo(10),
      updatedAt: minutesAgo(10),
    },
  });
  const staleDelivered = await createMessage({
    chat,
    sender: sender.user,
    text: "delivered private text should never leak",
    overrides: {
      status: "delivered",
      deliveredAt: minutesAgo(26 * 60),
      createdAt: minutesAgo(26 * 60),
      updatedAt: minutesAgo(26 * 60),
    },
  });
  await createMessage({
    chat,
    sender: recipient.user,
    text: "read private text should never leak",
    overrides: {
      status: "read",
      readAt: minutesAgo(25),
      createdAt: minutesAgo(25),
      updatedAt: minutesAgo(25),
    },
  });
  await createMessage({
    chat,
    sender: sender.user,
    text: "call activity should be excluded",
    overrides: {
      status: "sent",
      messageType: "call",
      createdAt: minutesAgo(12),
      updatedAt: minutesAgo(12),
    },
  });

  await NotificationOutbox.create({
    dedupeKey: `delivery-health-${staleSent._id}`,
    recipient: recipient.user._id,
    sender: sender.user._id,
    chatId: chat._id,
    messageId: staleDelivered._id,
    channel: NOTIFICATION_CHANNELS.EMAIL,
    eventType: "message",
    status: NOTIFICATION_OUTBOX_STATUS.FAILED,
    attempts: 2,
    payload: {
      templateKey: "message",
      title: "Private notification title",
      body: "private notification preview should never leak",
    },
    createdAt: minutesAgo(8),
    updatedAt: minutesAgo(8),
  });

  return { admin, sender, chat };
};

describe("admin delivery health diagnostics", () => {
  it("requires authentication and admin access", async () => {
    await request(app)
      .get("/api/admin/delivery-health")
      .expect(401);

    const normalUser = await signupWithAgent({
      firstName: "Delivery",
      lastName: "User",
      username: "delivery.normal",
    });

    await normalUser.agent
      .get("/api/admin/delivery-health")
      .expect(403);
  });

  it("rejects unsupported diagnostic windows", async () => {
    const { admin } = await setupDeliveryHealthScenario();

    const response = await admin.agent
      .get("/api/admin/delivery-health?window=30d")
      .expect(400);

    expect(response.body.message).toBe("Invalid delivery health window");
  });

  it("returns aggregate delivery health without message or outbox payload content", async () => {
    const { admin, sender, chat } = await setupDeliveryHealthScenario();

    const response = await admin.agent
      .get("/api/admin/delivery-health?window=7d")
      .expect(200);
    const deliveryHealth = response.body.data.deliveryHealth;
    const serialized = JSON.stringify(response.body);

    expect(deliveryHealth.window.key).toBe("7d");
    expect(deliveryHealth.summary).toMatchObject({
      totalMessages: 3,
      sent: 1,
      delivered: 1,
      read: 1,
      staleSent: 1,
      staleDelivered: 1,
      deliveryRate: 66.7,
      readRate: 33.3,
    });
    expect(deliveryHealth.riskConversations).toEqual([
      expect.objectContaining({
        chatId: chat._id.toString(),
        kind: "direct",
        memberCount: 2,
        recentMessages: 3,
        staleSent: 1,
        staleDelivered: 1,
        unreadEstimate: 2,
      }),
    ]);
    expect(deliveryHealth.runtime.socket).toMatchObject({
      initialized: false,
      connectedUsers: 0,
      connectedSockets: 0,
    });
    expect(deliveryHealth.outbox).toMatchObject({
      status: "degraded",
      total: 1,
      attempts: 2,
      byStatus: {
        failed: 1,
        pending: 0,
        processing: 0,
        sent: 0,
      },
    });
    expect(serialized).not.toContain("private delivery text");
    expect(serialized).not.toContain("private notification preview");
    expect(serialized).not.toContain(sender.user.email);
  });
});
