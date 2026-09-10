import { prisma } from './index';

export const getOrCreateDefaultUserAndSender = async (senderEmail?: string) => {
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
    where: { emailAddress: emailToUse },
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
};
