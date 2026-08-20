import Chats from "../Models/chatModel.mjs";
import Message from "../Models/messageModel.mjs";
import NotificationOutbox, {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_OUTBOX_STATUS,
} from "../Models/notificationOutboxModel.mjs";
import { getSocketOperationalStatus } from "../Config/socket.mjs";
import { MESSAGE_STATUS, MESSAGE_TYPE, toIdString } from "./messageState.mjs";

const DELIVERY_HEALTH_WINDOWS = Object.freeze({
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});

export const DEFAULT_DELIVERY_HEALTH_WINDOW = "24h";
export const DELIVERY_HEALTH_RISK_LIMIT = 10;
export const STALE_SENT_MS = 5 * 60 * 1000;
export const STALE_DELIVERED_MS = 24 * 60 * 60 * 1000;

const DELIVERY_HEALTH_STATUSES = Object.freeze(["ok", "degraded", "blocked"]);
const MESSAGE_STATUSES = Object.values(MESSAGE_STATUS);
const OUTBOX_STATUSES = Object.values(NOTIFICATION_OUTBOX_STATUS);
const OUTBOX_CHANNELS = Object.values(NOTIFICATION_CHANNELS);

const serializeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const buildCountMap = (rows, allowedKeys, valueKey = "count") => {
  const counts = Object.fromEntries(allowedKeys.map((key) => [key, 0]));

  for (const row of rows) {
    if (row?._id in counts) {
      counts[row._id] = row[valueKey] ?? row.count ?? 0;
    }
  }

  return counts;
};

const roundRate = (numerator, denominator) => {
  if (!denominator) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
};

const normalizeStatus = (status) => DELIVERY_HEALTH_STATUSES.includes(status) ? status : "ok";

export const normalizeDeliveryHealthWindow = (value) => {
  if (value === undefined || value === null) {
    return {
      ok: true,
      windowKey: DEFAULT_DELIVERY_HEALTH_WINDOW,
      durationMs: DELIVERY_HEALTH_WINDOWS[DEFAULT_DELIVERY_HEALTH_WINDOW],
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      statusCode: 400,
      message: "Invalid delivery health window",
    };
  }

  const windowKey = value.trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(DELIVERY_HEALTH_WINDOWS, windowKey)) {
    return {
      ok: false,
      statusCode: 400,
      message: "Invalid delivery health window",
    };
  }

  return {
    ok: true,
    windowKey,
    durationMs: DELIVERY_HEALTH_WINDOWS[windowKey],
  };
};

const getConversationKind = (chat) => {
  if (chat?.isSpaceChannel) {
    return "space_channel";
  }

  if (chat?.isGroupChat) {
    return "group";
  }

  return "direct";
};

const buildRuntimeHealth = () => {
  try {
    const socket = getSocketOperationalStatus();

    return {
      status: socket.initialized ? "ok" : "blocked",
      socket,
    };
  } catch {
    return {
      status: "blocked",
      socket: {
        initialized: false,
        connectedUsers: 0,
        connectedSockets: 0,
        pendingCallTimeouts: 0,
        pendingCallDisconnectCleanups: 0,
      },
    };
  }
};

const buildOutboxHealth = (rows) => {
  const byStatus = Object.fromEntries(OUTBOX_STATUSES.map((status) => [status, 0]));
  const byChannel = Object.fromEntries(
    OUTBOX_CHANNELS.map((channel) => [
      channel,
      {
        total: 0,
        byStatus: Object.fromEntries(OUTBOX_STATUSES.map((status) => [status, 0])),
        attempts: 0,
      },
    ])
  );
  let total = 0;
  let attempts = 0;

  for (const row of rows) {
    const status = row?._id?.status;
    const channel = row?._id?.channel;
    const count = row?.count ?? 0;
    const rowAttempts = row?.attempts ?? 0;

    if (status in byStatus) {
      byStatus[status] += count;
    }

    if (channel in byChannel) {
      byChannel[channel].total += count;
      byChannel[channel].attempts += rowAttempts;

      if (status in byChannel[channel].byStatus) {
        byChannel[channel].byStatus[status] += count;
      }
    }

    total += count;
    attempts += rowAttempts;
  }

  return {
    status: byStatus.failed > 0 ? "degraded" : "ok",
    total,
    attempts,
    byStatus,
    byChannel,
  };
};

const buildRiskConversations = async (riskRows) => {
  const chatIds = riskRows
    .map((row) => row._id)
    .filter(Boolean);
  const chats = await Chats.find({ _id: { $in: chatIds } })
    .select("members isGroupChat isSpaceChannel updatedAt")
    .lean();
  const chatsById = new Map(chats.map((chat) => [chat._id.toString(), chat]));

  return riskRows.map((row) => {
    const chatId = toIdString(row._id);
    const chat = chatsById.get(chatId);

    return {
      chatId,
      kind: getConversationKind(chat),
      memberCount: chat?.members?.length ?? 0,
      recentMessages: row.recentMessages ?? 0,
      staleSent: row.staleSent ?? 0,
      staleDelivered: row.staleDelivered ?? 0,
      unreadEstimate: row.unreadEstimate ?? 0,
      riskScore: row.riskScore ?? 0,
      latestActivityAt: serializeDate(row.latestActivityAt ?? chat?.updatedAt),
      flags: {
        hasStaleSent: (row.staleSent ?? 0) > 0,
        hasStaleDelivered: (row.staleDelivered ?? 0) > 0,
        hasUnreadEstimate: (row.unreadEstimate ?? 0) > 0,
      },
    };
  });
};

export const buildDeliveryHealthPayload = async ({
  windowKey = DEFAULT_DELIVERY_HEALTH_WINDOW,
  now = new Date(),
} = {}) => {
  const normalized = normalizeDeliveryHealthWindow(windowKey);
  const resolvedWindowKey = normalized.ok ? normalized.windowKey : DEFAULT_DELIVERY_HEALTH_WINDOW;
  const durationMs = normalized.ok
    ? normalized.durationMs
    : DELIVERY_HEALTH_WINDOWS[DEFAULT_DELIVERY_HEALTH_WINDOW];
  const windowStartedAt = new Date(now.getTime() - durationMs);
  const staleSentBefore = new Date(now.getTime() - STALE_SENT_MS);
  const staleDeliveredBefore = new Date(now.getTime() - STALE_DELIVERED_MS);
  const baseMessageMatch = {
    createdAt: { $gte: windowStartedAt, $lte: now },
    messageType: { $ne: MESSAGE_TYPE.CALL },
  };

  const [
    statusRows,
    staleSent,
    staleDelivered,
    riskRows,
    outboxRows,
  ] = await Promise.all([
    Message.aggregate([
      { $match: baseMessageMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Message.countDocuments({
      ...baseMessageMatch,
      status: MESSAGE_STATUS.SENT,
      createdAt: { $gte: windowStartedAt, $lte: staleSentBefore },
    }),
    Message.countDocuments({
      ...baseMessageMatch,
      status: MESSAGE_STATUS.DELIVERED,
      createdAt: { $gte: windowStartedAt, $lte: staleDeliveredBefore },
    }),
    Message.aggregate([
      { $match: baseMessageMatch },
      {
        $group: {
          _id: "$chatId",
          recentMessages: { $sum: 1 },
          sent: {
            $sum: {
              $cond: [{ $eq: ["$status", MESSAGE_STATUS.SENT] }, 1, 0],
            },
          },
          delivered: {
            $sum: {
              $cond: [{ $eq: ["$status", MESSAGE_STATUS.DELIVERED] }, 1, 0],
            },
          },
          staleSent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", MESSAGE_STATUS.SENT] },
                    { $lte: ["$createdAt", staleSentBefore] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          staleDelivered: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", MESSAGE_STATUS.DELIVERED] },
                    { $lte: ["$createdAt", staleDeliveredBefore] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          latestActivityAt: { $max: "$createdAt" },
        },
      },
      {
        $addFields: {
          unreadEstimate: { $add: ["$sent", "$delivered"] },
          riskScore: {
            $add: [
              { $multiply: ["$staleSent", 3] },
              { $multiply: ["$staleDelivered", 2] },
              "$sent",
              "$delivered",
            ],
          },
        },
      },
      { $match: { riskScore: { $gt: 0 } } },
      { $sort: { staleSent: -1, staleDelivered: -1, unreadEstimate: -1, latestActivityAt: -1 } },
      { $limit: DELIVERY_HEALTH_RISK_LIMIT },
    ]),
    NotificationOutbox.aggregate([
      {
        $match: {
          eventType: "message",
          createdAt: { $gte: windowStartedAt, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            channel: "$channel",
          },
          count: { $sum: 1 },
          attempts: { $sum: "$attempts" },
        },
      },
    ]),
  ]);

  const runtime = buildRuntimeHealth();
  const outbox = buildOutboxHealth(outboxRows);
  const statusCounts = buildCountMap(statusRows, MESSAGE_STATUSES);
  const totalMessages = MESSAGE_STATUSES.reduce((total, status) => total + statusCounts[status], 0);
  const deliveredOrRead = statusCounts.delivered + statusCounts.read;
  const healthStatus = runtime.status === "blocked"
    ? "blocked"
    : staleSent > 0 || staleDelivered > 0 || outbox.status === "degraded"
      ? "degraded"
      : "ok";

  return {
    generatedAt: serializeDate(now),
    window: {
      key: resolvedWindowKey,
      startedAt: serializeDate(windowStartedAt),
      endedAt: serializeDate(now),
    },
    summary: {
      status: normalizeStatus(healthStatus),
      totalMessages,
      sent: statusCounts.sent,
      delivered: statusCounts.delivered,
      read: statusCounts.read,
      staleSent,
      staleDelivered,
      deliveryRate: roundRate(deliveredOrRead, totalMessages),
      readRate: roundRate(statusCounts.read, totalMessages),
    },
    riskConversations: await buildRiskConversations(riskRows),
    runtime,
    outbox,
  };
};
