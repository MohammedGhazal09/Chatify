import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

const PROFILE_IMAGE_BUCKET_NAME = 'chatifyProfileImages';

const normalizeProfileImageStorageId = (value) => {
  const normalizedValue = value?._id?.toString?.() ?? value?.toString?.() ?? value;

  if (!ObjectId.isValid(normalizedValue)) {
    throw new Error('Invalid profile image storage id');
  }

  return new ObjectId(normalizedValue);
};

export const getProfileImageBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready for profile image storage');
  }

  return new GridFSBucket(mongoose.connection.db, {
    bucketName: PROFILE_IMAGE_BUCKET_NAME,
  });
};

export const uploadProfileImageBuffer = ({
  buffer,
  filename,
  contentType,
  metadata = {},
}) => {
  const bucket = getProfileImageBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata,
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });

    Readable.from(buffer).pipe(uploadStream);
  });
};

export const openProfileImageDownloadStream = (storageFileId) => {
  const bucket = getProfileImageBucket();
  return bucket.openDownloadStream(normalizeProfileImageStorageId(storageFileId));
};

export const deleteProfileImageFile = async (storageFileId) => {
  const bucket = getProfileImageBucket();

  try {
    await bucket.delete(normalizeProfileImageStorageId(storageFileId));
  } catch (error) {
    if (error?.codeName === 'FileNotFound' || /FileNotFound/i.test(error?.message ?? '')) {
      return;
    }

    throw error;
  }
};
