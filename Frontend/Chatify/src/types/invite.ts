import type { User } from './auth';
import type { Chat } from './chat';
import type { Space } from './space';

export type InviteTargetType = 'group' | 'space';
export type InviteLinkState = 'active' | 'revoked' | 'expired' | 'exhausted';
export type InviteExpiryDays = 1 | 7 | 30;
export type InviteMaxUses = 1 | 5 | 10 | 'unlimited';

export interface InviteLink {
  _id: string;
  targetType: InviteTargetType;
  targetId: string;
  createdBy?: User;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  state: InviteLinkState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInviteLinkPayload {
  expiresInDays: InviteExpiryDays;
  maxUses: InviteMaxUses;
}

export interface CreateInviteLinkResult {
  invite: InviteLink;
  inviteUrl: string;
}

export type JoinInviteLinkResult =
  | {
      targetType: 'group';
      alreadyMember: boolean;
      chat: Chat;
    }
  | {
      targetType: 'space';
      alreadyMember: boolean;
      space: Space;
    };
