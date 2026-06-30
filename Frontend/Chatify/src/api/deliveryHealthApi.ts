import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';

export type DeliveryHealthWindowKey = '1h' | '24h' | '7d';
export type DeliveryHealthStatus = 'ok' | 'degraded' | 'blocked';
export type DeliveryHealthConversationKind = 'direct' | 'group' | 'space_channel';
export type NotificationOutboxStatus = 'pending' | 'processing' | 'sent' | 'failed';
export type NotificationOutboxChannel = 'email' | 'push';

export interface DeliveryHealthWindow {
  key: DeliveryHealthWindowKey;
  startedAt: string | null;
  endedAt: string | null;
}

export interface DeliveryHealthSummary {
  status: DeliveryHealthStatus;
  totalMessages: number;
  sent: number;
  delivered: number;
  read: number;
  staleSent: number;
  staleDelivered: number;
  deliveryRate: number;
  readRate: number;
}

export interface DeliveryHealthRiskConversation {
  chatId: string | null;
  kind: DeliveryHealthConversationKind;
  memberCount: number;
  recentMessages: number;
  staleSent: number;
  staleDelivered: number;
  unreadEstimate: number;
  riskScore: number;
  latestActivityAt: string | null;
  flags: {
    hasStaleSent: boolean;
    hasStaleDelivered: boolean;
    hasUnreadEstimate: boolean;
  };
}

export interface DeliveryHealthRuntime {
  status: DeliveryHealthStatus;
  socket: {
    initialized: boolean;
    connectedUsers: number;
    connectedSockets: number;
    pendingCallTimeouts: number;
    pendingCallDisconnectCleanups: number;
  };
}

export interface DeliveryHealthOutboxChannel {
  total: number;
  attempts: number;
  byStatus: Record<NotificationOutboxStatus, number>;
}

export interface DeliveryHealthOutbox {
  status: Exclude<DeliveryHealthStatus, 'blocked'>;
  total: number;
  attempts: number;
  byStatus: Record<NotificationOutboxStatus, number>;
  byChannel: Record<NotificationOutboxChannel, DeliveryHealthOutboxChannel>;
}

export interface DeliveryHealthPayload {
  generatedAt: string | null;
  window: DeliveryHealthWindow;
  summary: DeliveryHealthSummary;
  riskConversations: DeliveryHealthRiskConversation[];
  runtime: DeliveryHealthRuntime;
  outbox: DeliveryHealthOutbox;
}

export interface DeliveryHealthResponse {
  status: string;
  data: {
    deliveryHealth: DeliveryHealthPayload;
  };
}

export const deliveryHealthApi = {
  getDeliveryHealth: (
    window: DeliveryHealthWindowKey = '24h'
  ): Promise<AxiosResponse<DeliveryHealthResponse>> =>
    axiosInstance.get('/api/admin/delivery-health', {
      params: { window },
    }),
};
