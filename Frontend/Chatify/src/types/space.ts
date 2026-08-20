import type { User } from './auth';
import type { Chat } from './chat';

export type SpaceRole = 'owner' | 'admin' | 'member';

export interface SpaceMember {
  userId: string;
  user?: User;
  role: SpaceRole;
  joinedAt?: string | null;
}

export interface SpaceChannel extends Chat {
  id?: string;
  isGroupChat: true;
  isSpaceChannel: true;
  space: string;
  spaceId: string;
  channelName: string;
  channelKey: string;
  channelDescription?: string;
}

export interface Space {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  owner: string;
  createdBy?: string;
  requesterRole: SpaceRole | null;
  canManage: boolean;
  members: SpaceMember[];
  memberCount: number;
  defaultChannel?: string;
  defaultChannelId?: string;
  channels?: SpaceChannel[];
  joinCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpacePayload {
  name: string;
  description?: string;
  memberUsernames?: string[];
}

export interface JoinSpacePayload {
  joinCode: string;
}

export interface AddSpaceMemberPayload {
  username: string;
  role?: Extract<SpaceRole, 'admin' | 'member'>;
}

export interface CreateSpaceChannelPayload {
  name: string;
  description?: string;
}
