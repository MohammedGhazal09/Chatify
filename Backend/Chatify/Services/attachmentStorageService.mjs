import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

const ATTACHMENT_BUCKET_NAME = 'chatifyAttachments';

const normalizeStorageId = (value) => {
  const normalizedValue = value?._id?.toString?.() ?? value?.toString?.() ?? value;

  if (!ObjectId.isValid(normalizedValue)) {
    throw new Error('Invalid attachment storage id');
  }

  return new ObjectId(normalizedValue);
};

export const getAttachmentBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready for attachment storage');
  }

  return new GridFSBucket(mongoose.connection.db, {
    bucketName: ATTACHMENT_BUCKET_NAME,
  });
};

export const uploadAttachmentBuffer = ({
  buffer,
  filename,
  contentType,
  metadata = {},
}) => {
  const bucket = getAttachmentBucket();

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

export const openAttachmentDownloadStream = (storageFileId) => {
  const bucket = getAttachmentBucket();
  return bucket.openDownloadStream(normalizeStorageId(storageFileId));
};

export const deleteAttachmentFile = async (storageFileId) => {
  const bucket = getAttachmentBucket();

  try {
    await bucket.delete(normalizeStorageId(storageFileId));
  } catch (error) {
    if (error?.codeName === 'FileNotFound' || /FileNotFound/i.test(error?.message ?? '')) {
      return;
    }

    throw error;
  }
};
