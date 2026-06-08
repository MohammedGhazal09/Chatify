import { io as createClientSocket } from 'socket.io-client';
import { signupWithAgent } from './authAgent.mjs';

export const extractCookieHeader = (response) => {
  const setCookies = response.headers?.['set-cookie'] ?? [];
  const cookieParts = setCookies.map((cookie) => cookie.split(';')[0]);
  return cookieParts.join('; ');
};

export const waitForSocketEvent = (socket, eventName, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for socket event "${eventName}"`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };

    socket.once(eventName, onEvent);
  });
};

export const emitWithAck = (socket, eventName, payload, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack on "${eventName}"`));
    }, timeoutMs);

    socket.emit(eventName, payload, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
};

export const connectSocketWithCookie = (url, cookieHeader, options = {}) => {
  const extraHeaders = cookieHeader ? { Cookie: cookieHeader } : undefined;
  const socket = createClientSocket(url, {
    withCredentials: true,
    transports: ['polling', 'websocket'],
    forceNew: true,
    reconnection: false,
    autoConnect: false,
    timeout: 5000,
    extraHeaders,
    transportOptions: extraHeaders
      ? {
          polling: { extraHeaders },
          websocket: { extraHeaders },
        }
      : {},
    ...options,
  });

  return socket;
};

export const connectSocketWithReady = async (url, cookieHeader, options = {}) => {
  const socket = connectSocketWithCookie(url, cookieHeader, options);
  const readyPromise = waitForSocketEvent(socket, 'socket:ready');
  socket.connect();
  const ready = await readyPromise;

  return { socket, ready };
};

export const connectSocketForSignup = async (url, signup, options = {}) => {
  const cookieHeader = extractCookieHeader(signup.response);
  const { socket, ready } = await connectSocketWithReady(url, cookieHeader, options);

  return {
    ...signup,
    cookieHeader,
    socket,
    ready,
  };
};

export const connectSocketAsUser = async (url, userOverrides = {}, options = {}) => {
  const signup = await signupWithAgent(userOverrides);
  return connectSocketForSignup(url, signup, options);
};
