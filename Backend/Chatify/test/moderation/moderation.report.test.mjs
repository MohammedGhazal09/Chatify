import { describe, expect, it } from "vitest";
import { signupWithAgent } from "../helpers/authAgent.mjs";

describe("space channel moderation report context", () => {
  it("serializes channel context without private member data for conversation reports", async () => {
    const owner = await signupWithAgent({
      firstName: "Channel",
      lastName: "Owner",
      username: "channel.report.owner",
      email: "channel-report-owner@example.test",
    });
    const member = await signupWithAgent({
      firstName: "Channel",
      lastName: "Member",
      username: "channel.report.member",
      email: "channel-report-member@example.test",
    });
    const created = await owner.agent
      .post("/api/space")
      .send({
        name: "Moderation Channel Space",
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;
    const channelId = created.body.data.channel._id;

    const response = await member.agent
      .post("/api/moderation/reports")
      .send({
        targetType: "conversation",
        chatId: channelId,
        reportedUserId: owner.user._id.toString(),
        reason: "privacy",
        details: "Conversation report contains reporter@example.test",
      })
      .expect(201);
    const serialized = JSON.stringify(response.body);

    expect(response.body.data.report).toMatchObject({
      targetType: "conversation",
      chat: channelId,
      reportedUser: owner.user._id.toString(),
      reason: "privacy",
      details: "Conversation report contains [redacted-email]",
    });
    expect(response.body.data.report.context.chat).toMatchObject({
      chatId: channelId,
      isGroupChat: true,
      isSpaceChannel: true,
      spaceId,
      channelId,
      channelName: "general",
      memberCount: 2,
    });
    expect(serialized).not.toContain(owner.user.email);
    expect(serialized).not.toContain(member.user.email);
    expect(serialized).not.toContain("Moderation Channel Space");
  });
});
