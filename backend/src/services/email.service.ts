import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let cachedTransporter: Transporter | null = null;

const getTransporter = async (): Promise<Transporter> => {
  if (cachedTransporter) return cachedTransporter;

  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    console.log(`📬 Using configured Ethereal account: ${env.ETHEREAL_USER}`);
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASS,
      },
    });
    return cachedTransporter;
  }

  try {
    console.log('📬 Initializing auto-generated Ethereal Email test account...');
    const testAccountPromise = nodemailer.createTestAccount();
    const testAccount = await Promise.race([
      testAccountPromise,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Ethereal test account creation timeout')), 5000)),
    ]);
    console.log(`✨ Ethereal Email account created: ${testAccount.user}`);

    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    return cachedTransporter;
  } catch (err: any) {
    console.warn('⚠️ Ethereal account creation failed, using sandbox JSON transport:', err?.message);
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return cachedTransporter;
  }
};

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export const sendEmail = async ({
  from,
  to,
  subject,
  body,
}: SendEmailParams): Promise<SendEmailResult> => {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: body,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`📨 Email sent to ${to} | Message ID: ${info.messageId}`);
  if (previewUrl) {
    console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
};
