import mongoose from 'mongoose'
import validator from 'validator'
import { verify, hash } from 'argon2'
const userSchema = new mongoose.Schema({
   firstName: {
      type: String,
      required: true,
      trim: true
   },
    lastName: {
        type: String,
        required: true,
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
        required: true,
        minlength: [8, 'Password must be at least 8 characters long'],
        trim: true,
        maxlength: [100, 'Password must be at most 100 characters long'],
        select: false,
    },
    profilePic: {
        type: String,
        required: false
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.password; // Exclude password from the output
            return ret;
        }
    },
  })

  // Hashing Password before saving
  userSchema.pre('save', async function(next) {
    try {
    this.password = await hash(this.password)
    next()
    } catch(err){ 
      next(err)
    }
  })

  userSchema.methods.checkPassword = async function(givenPassword)  {
    return await verify(this.password,givenPassword)
  }

  const User = mongoose.model('Users', userSchema)

  export default User