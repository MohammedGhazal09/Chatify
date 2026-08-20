export const tinyPngBuffer = () => Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

export const tinyJpegBuffer = () => Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
  'base64'
);

export const tinyWebpBuffer = () => Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=',
  'base64'
);

export const tinyGifBuffer = () => Buffer.from('R0lGODlhAQABAAAAACw=', 'base64');

export const tinyExecutableBuffer = () => Buffer.from('MZ executable fixture', 'utf8');

export const oversizedProfileImageBuffer = () => Buffer.alloc((2 * 1024 * 1024) + 1, 1);

export const profileImageCases = Object.freeze([
  {
    name: 'png',
    filename: 'profile.png',
    contentType: 'image/png',
    buffer: tinyPngBuffer,
  },
  {
    name: 'jpeg',
    filename: 'profile.jpg',
    contentType: 'image/jpeg',
    buffer: tinyJpegBuffer,
  },
  {
    name: 'webp',
    filename: 'profile.webp',
    contentType: 'image/webp',
    buffer: tinyWebpBuffer,
  },
]);

export const attachProfileImage = (request, {
  filename = 'profile.png',
  contentType = 'image/png',
  buffer = tinyPngBuffer(),
} = {}) => (
  request.attach('profileImage', buffer, {
    filename,
    contentType,
  })
);
