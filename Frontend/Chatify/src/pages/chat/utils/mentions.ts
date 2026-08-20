import type { User } from '../../../types/auth';
import type { MessageMention } from '../../../types/chat';

const USERNAME_TOKEN_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export interface MentionTrigger {
  query: string;
  start: number;
  end: number;
}

const escapeRegexLiteral = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMemberDisplayName = (member: User) => (
  `${member.firstName ?? ''} ${member.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
  || member.username
  || 'Member'
);

export const getEligibleMentionMembers = (
  members: User[] = [],
  currentUserId?: string
) => members.filter((member) => (
  Boolean(member._id && member.username && member._id !== currentUserId)
));

export const findActiveMentionTrigger = (
  value: string,
  caretIndex: number
): MentionTrigger | null => {
  const safeCaretIndex = Math.max(0, Math.min(caretIndex, value.length));
  const beforeCaret = value.slice(0, safeCaretIndex);
  const tokenMatch = beforeCaret.match(/(^|\s)@([a-zA-Z0-9._-]{0,30})$/);

  if (!tokenMatch || tokenMatch.index === undefined) {
    return null;
  }

  const prefixLength = tokenMatch[1]?.length ?? 0;

  return {
    query: tokenMatch[2] ?? '',
    start: tokenMatch.index + prefixLength,
    end: safeCaretIndex,
  };
};

export const filterMentionMembers = (
  members: User[],
  query: string,
  limit = 5
) => {
  const normalizedQuery = query.toLocaleLowerCase('en-US');

  return members
    .filter((member) => {
      const username = member.username?.toLocaleLowerCase('en-US') ?? '';
      const displayName = getMemberDisplayName(member).toLocaleLowerCase('en-US');
      return username.startsWith(normalizedQuery) || displayName.includes(normalizedQuery);
    })
    .slice(0, limit);
};

export const buildMentionSnapshots = (
  mentionUserIds: string[],
  members: User[]
): MessageMention[] => {
  const membersById = new Map(members.map((member) => [member._id, member]));

  return mentionUserIds
    .map((userId) => {
      const member = membersById.get(userId);

      if (!member?.username) {
        return null;
      }

      return {
        userId,
        username: member.username,
        displayName: getMemberDisplayName(member),
      };
    })
    .filter((mention): mention is MessageMention => Boolean(mention));
};

export const extractMentionUserIds = (
  text: string,
  members: User[],
  currentUserId?: string
) => {
  const eligibleMembers = getEligibleMentionMembers(members, currentUserId);
  const membersByUsername = new Map(
    eligibleMembers.map((member) => [(member.username ?? '').toLocaleLowerCase('en-US'), member])
  );
  const mentionedUserIds: string[] = [];
  const seenUserIds = new Set<string>();
  const tokenPattern = /(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]{2,30})(?=$|[^a-zA-Z0-9._-])/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    const username = match[2]?.toLocaleLowerCase('en-US') ?? '';

    if (!USERNAME_TOKEN_PATTERN.test(username)) {
      continue;
    }

    const member = membersByUsername.get(username);

    if (!member || seenUserIds.has(member._id)) {
      continue;
    }

    seenUserIds.add(member._id);
    mentionedUserIds.push(member._id);
  }

  return mentionedUserIds;
};

export const replaceMentionTrigger = (
  value: string,
  trigger: MentionTrigger,
  username: string
) => {
  const replacement = `@${username} `;
  const nextValue = `${value.slice(0, trigger.start)}${replacement}${value.slice(trigger.end)}`;
  const nextCaretIndex = trigger.start + replacement.length;

  return {
    value: nextValue,
    caretIndex: nextCaretIndex,
  };
};

export const mentionTokenPattern = (mentions: MessageMention[]) => {
  const usernames = Array.from(new Set(
    mentions
      .map((mention) => mention.username)
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)
      .map(escapeRegexLiteral)
  ));

  if (usernames.length === 0) {
    return null;
  }

  return new RegExp(`(^|[^a-zA-Z0-9._-])(@(?:${usernames.join('|')}))(?=$|[^a-zA-Z0-9._-])`, 'gi');
};
