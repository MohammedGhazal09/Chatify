import mongoose from 'mongoose'
import validator from 'validator'
import { verify, hash } from 'argon2'
import {CustomError} from '../Utils/customError.mjs'
import {
  IDENTITY_MARK_ACCENT_IDS,
  IDENTITY_MARK_PALETTE_IDS,
  IDENTITY_MARK_PATTERN_IDS,
  attachSerializedIdentityMark,
} from '../Utils/identityMark.mjs'
import {
  normalizeUsername,
  validateUsername,
} from '../Utils/usernameValidation.mjs'

export const buildUploadedProfileImageUrl = ({ userId, version }) => {
  const safeVersion = encodeURIComponent(version || '1');
  return `/api/user/${userId}/profile-image?v=${safeVersion}`;
};

const isUploadedProfileImageUrl = (value) => (
  typeof value === 'string' &&
  /^\/api\/user\/[^/]+\/profile-image(?:\?|$)/.test(value)
);

const hideProfileImageInternals = (ret) => {
  delete ret.providerProfilePic;
  delete ret.uploadedProfileImage;
  return attachSerializedIdentityMark(ret);
};

const uploadedProfileImageSchema = new mongoose.Schema({
  storageFileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  version: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  _id: false,
  versionKey: false,
});

const identityMarkSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 32,
  },
  initials: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 3,
  },
  paletteId: {
    type: String,
    required: true,
    enum: IDENTITY_MARK_PALETTE_IDS,
  },
  patternId: {
    type: String,
    required: true,
    enum: IDENTITY_MARK_PATTERN_IDS,
  },
  accentId: {
    type: String,
    required: true,
    enum: IDENTITY_MARK_ACCENT_IDS,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  _id: false,
  versionKey: false,
});

const moderationStateSchema = new mongoose.Schema({
  lastWarningAt: {
    type: Date,
  },
  lastWarningBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  warningReason: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  messagingRestrictedUntil: {
    type: Date,
  },
  restrictedAt: {
    type: Date,
  },
  restrictedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  restrictionReason: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  restrictionLiftedAt: {
    type: Date,
  },
  restrictionLiftedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
}, {
  _id: false,
  versionKey: false,
});

const userSchema = new mongoose.Schema({
   firstName: {
      type: String,
      required: true,
      trim: true
   },
    lastName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        validate: [validator.isEmail, 'Please provide a valid email address'],
    },
    username: {
        type: String,
        required: false,
        trim: true,
        lowercase: true,
        set: normalizeUsername,
        validate: {
          validator(value) {
            return !value || validateUsername(value).ok;
          },
          message: 'Username must be 3-24 letters, numbers, dots, or underscores',
        },
    },
    password: {
        type: String,
        required: function() {
          return this.authProvider === 'local';
        },
        minlength: [8, 'Password must be at least 8 characters long'],
        trim: true,
        maxlength: [100, 'Password must be at most 100 characters long'],
        select: false,
    },
    profilePic: {
        type: String,
        required: false
    },
    providerProfilePic: {
        type: String,
        required: false,
        select: false,
    },
    uploadedProfileImage: {
        type: uploadedProfileImageSchema,
        required: false,
        select: false,
    },
    identityMark: {
        type: identityMarkSchema,
        required: false,
    },
    identityMarkUpdatedAt: {
        type: Date,
        required: false,
    },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'discord', 'github'],
        default: 'local',
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
        select: false,
    },
    moderation: {
        type: moderationStateSchema,
        default: () => ({}),
        select: false,
    },
    googleId: {
      type: String,
      sparse: true
    },
    discordId: {
      type: String,
      sparse: true
    },
    githubId: {
      type: String,
      sparse: true
    },
    isVerified: {
      type: Boolean,
      default: function() {
        return this.authProvider !== 'local';
      }
    },
    // Online/Offline status tracking
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    // Privacy settings for online status
    showOnlineStatus: {
      type: Boolean,
      default: true,
    },
    showLastSeen: {
      type: Boolean,
      default: true,
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.password; // Exclude password from the output
            delete ret.googleId;
            delete ret.discordId;
            delete ret.githubId;
            delete ret.moderation;
            return hideProfileImageInternals(ret);
        }
    },
    toObject: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.password;
            delete ret.googleId;
            delete ret.discordId;
            delete ret.githubId;
            delete ret.moderation;
            return hideProfileImageInternals(ret);
        }
    },
  })

  userSchema.index({ googleId: 1, authProvider: 1})
  userSchema.index({ discordId: 1, authProvider: 1})
  userSchema.index({ githubId: 1, authProvider: 1})
  userSchema.index(
    { username: 1 },
    {
      unique: true,
      partialFilterExpression: { username: { $type: 'string' } },
    }
  )

  // Hashing Password before saving
  userSchema.pre('save', async function(next) {
    try {
      if (this.isModified('password'))
    this.password = await hash(this.password)
    next()
    } catch(err){ 
      next(CustomError('Error hashing password', 500))
    }
  })

  userSchema.methods.hashPassword = async function(password) {
    return await hash(password)
  }
  
  userSchema.methods.checkPassword = async function(givenPassword)  {
    if (!this.password) {
      return false;
    }
    return await verify(this.password,givenPassword)
  }

  userSchema.methods.hasUploadedProfileImage = function() {
    return Boolean(this.uploadedProfileImage?.storageFileId);
  }

  userSchema.methods.setUploadedProfileImage = function({ storageFileId, mimeType, size, version }) {
    this.uploadedProfileImage = {
      storageFileId,
      mimeType,
      size,
      version,
      updatedAt: new Date(),
    };
    this.profilePic = buildUploadedProfileImageUrl({ userId: this._id, version });
  }

  userSchema.methods.clearUploadedProfileImage = function() {
    const fallbackProfilePic = this.providerProfilePic || (
      isUploadedProfileImageUrl(this.profilePic) ? '' : this.profilePic
    ) || '';

    this.uploadedProfileImage = undefined;
    this.profilePic = fallbackProfilePic;
  }

  userSchema.methods.setIdentityMark = function(identityMark) {
    this.identityMark = identityMark;
    this.identityMarkUpdatedAt = identityMark.updatedAt ?? new Date();
  }

  const User = mongoose.model('Users', userSchema)

  export default User
