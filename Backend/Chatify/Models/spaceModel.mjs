import mongoose from 'mongoose';

export const SPACE_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
});

export const SPACE_LIMITS = Object.freeze({
  members: 25,
  channels: 10,
});

const spaceMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  role: {
    type: String,
    enum: Object.values(SPACE_ROLES),
    default: SPACE_ROLES.MEMBER,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  _id: false,
  versionKey: false,
});

const memberUserId = (member) => (
  member.user?._id?.toString?.() ?? member.user?.toString?.()
);

const refId = (value) => (
  value?._id?.toString?.() ?? value?.toString?.()
);

const spaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Space name must be at least 2 characters'],
    maxlength: [80, 'Space name must be 80 characters or fewer'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [240, 'Space description must be 240 characters or fewer'],
    default: '',
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  members: {
    type: [spaceMemberSchema],
    default: [],
  },
  defaultChannel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chats',
  },
}, {
  timestamps: true,
  versionKey: false,
});

spaceSchema.pre('validate', function validateSpaceMembership(next) {
  const memberIds = (this.members ?? [])
    .map(memberUserId)
    .filter(Boolean);
  const uniqueMemberIds = new Set(memberIds);
  const ownerId = refId(this.owner);

  if (memberIds.length !== uniqueMemberIds.size) {
    this.invalidate('members', 'Space members must be unique');
  }

  if (uniqueMemberIds.size < 1 || uniqueMemberIds.size > SPACE_LIMITS.members) {
    this.invalidate('members', `Spaces can have up to ${SPACE_LIMITS.members} members`);
  }

  const ownerMember = (this.members ?? []).find((member) => memberUserId(member) === ownerId);

  if (!ownerMember) {
    this.invalidate('members', 'Space owner must be a member');
  } else if (ownerMember.role !== SPACE_ROLES.OWNER) {
    this.invalidate('members', 'Space owner must have the owner role');
  }

  next();
});

spaceSchema.index({ 'members.user': 1 });
spaceSchema.index({ owner: 1 });

const Spaces = mongoose.model('Spaces', spaceSchema);

export default Spaces;
