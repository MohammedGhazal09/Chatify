import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: axiosMock,
}));

import { spaceApi } from './spaceApi';

describe('spaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds space list, create, and detail routes', () => {
    const payload = {
      name: 'Launch Room',
      description: 'Planning',
      memberUsernames: ['grace.hopper'],
    };

    spaceApi.getSpaces();
    spaceApi.getSpace('space-1');
    spaceApi.createSpace(payload);

    expect(axiosMock.get).toHaveBeenNthCalledWith(1, '/api/space');
    expect(axiosMock.get).toHaveBeenNthCalledWith(2, '/api/space/space-1');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/space', payload);
  });

  it('builds the self-serve join route from a join code', () => {
    spaceApi.joinSpace({ joinCode: 'ABCD2345' });

    expect(axiosMock.post).toHaveBeenCalledWith('/api/space/join', { joinCode: 'ABCD2345' });
  });

  it('builds channel and member routes without accepting email identifiers', () => {
    spaceApi.getSpaceChannels('space-1');
    spaceApi.createSpaceChannel('space-1', { name: 'announcements', description: 'Updates' });
    spaceApi.addSpaceMember('space-1', { username: 'alan.turing', role: 'member' });
    spaceApi.removeSpaceMember('space-1', 'user-2');

    expect(axiosMock.get).toHaveBeenCalledWith('/api/space/space-1/channels');
    expect(axiosMock.post).toHaveBeenNthCalledWith(1, '/api/space/space-1/channels', {
      name: 'announcements',
      description: 'Updates',
    });
    expect(axiosMock.post).toHaveBeenNthCalledWith(2, '/api/space/space-1/members', {
      username: 'alan.turing',
      role: 'member',
    });
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/space/space-1/members/user-2');
  });
});
