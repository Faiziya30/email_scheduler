import { prisma } from './index';

// In-memory fallback store when local PostgreSQL database is offline
export const memoryUsers = new Map<string, any>();
export const memorySenders = new Map<string, any>();

export const upsertGoogleUserMemory = (profile: { googleId: string; email: string; name?: string; avatarUrl?: string }) => {
  let existing = Array.from(memoryUsers.values()).find(u => u.googleId === profile.googleId || u.email === profile.email);
  if (!existing) {
    existing = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name || 'Google User',
      avatarUrl: profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'Google User')}`,
      createdAt: new Date(),
    };
  } else {
    existing.name = profile.name || existing.name;
    existing.avatarUrl = profile.avatarUrl || existing.avatarUrl;
  }
  memoryUsers.set(existing.id, existing);
  return existing;
};

export const getOrCreateSenderForUser = async (userId: string, senderEmail?: string) => {
  const emailToUse = senderEmail || 'sender@reachinbox.ai';
  try {
    let sender = await prisma.sender.findFirst({
      where: {
        userId,
        emailAddress: emailToUse,
      },
    });

    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          userId,
          emailAddress: emailToUse,
        },
      });
    }

    return sender;
  } catch (error) {
    console.warn('⚠️ Database query for sender fallback, creating in-memory sender.');
    const sender = {
      id: 'snd_' + Math.random().toString(36).substring(2, 9),
      userId,
      emailAddress: emailToUse,
      createdAt: new Date(),
    };
    memorySenders.set(sender.id, sender);
    return sender;
  }
};

export const getOrCreateDefaultUserAndSender = async (senderEmail?: string, userId?: string) => {
  if (userId) {
    const sender = await getOrCreateSenderForUser(userId, senderEmail);
    return { user: { id: userId }, sender };
  }
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: 'default-system-user',
          email: 'admin@reachinbox.ai',
          name: 'ReachInbox Admin',
          avatarUrl: 'https://ui-avatars.com/api/?name=Reach+Inbox',
        },
      });
    }

    const emailToUse = senderEmail || 'sender@reachinbox.ai';
    let sender = await prisma.sender.findFirst({
      where: { userId: user.id, emailAddress: emailToUse },
    });

    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          userId: user.id,
          emailAddress: emailToUse,
        },
      });
    }

    return { user, sender };
  } catch (error) {
    console.warn('⚠️ Database unreachable. Using fallback in-memory user & sender session.');
    const user = upsertGoogleUserMemory({
      googleId: 'default-system-user',
      email: 'admin@reachinbox.ai',
      name: 'ReachInbox Admin',
      avatarUrl: 'https://ui-avatars.com/api/?name=Reach+Inbox',
    });
    const sender = {
      id: 'snd_' + user.id,
      userId: user.id,
      emailAddress: senderEmail || 'sender@reachinbox.ai',
      createdAt: new Date(),
    };
    memorySenders.set(sender.id, sender);
    return { user, sender };
  }
};


