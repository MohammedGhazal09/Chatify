import mongoose from 'mongoose'
import validator from 'validator'
import { verify, hash } from 'argon2'
import {CustomError} from '../Utils/customError.mjs'

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
    authProvider: {
        type: String,
        enum: ['local', 'google', 'discord', 'github'],
        default: 'local',
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
            return ret;
        }
    },
  })

  userSchema.index({ googleId: 1, authProvider: 1})
  userSchema.index({ discordId: 1, authProvider: 1})
  userSchema.index({ githubId: 1, authProvider: 1})

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
    return await verify(this.password,givenPassword)
  }

  const User = mongoose.model('Users', userSchema)

  export default User