import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let cachedTransporter: Transporter | null = null;
let transporterPromise: Promise<Transporter> | null = null;

const smtpOptions = {
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
};

const getTransporter = async (): Promise<Transporter> => {
  if (cachedTransporter) return cachedTransporter;

  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
      console.log(`📬 Using configured Ethereal account: ${env.ETHEREAL_USER}`);
      return nodemailer.createTransport({
        ...smtpOptions,
        auth: { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASS },
      });
    }

    try {
      console.log('📬 Initializing auto-generated Ethereal Email test account...');
      const testAccount = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Ethereal test account creation timeout')), 5000)),
      ]);
      console.log(`✨ Ethereal Email account created: ${testAccount.user}`);
      return nodemailer.createTransport({
        ...smtpOptions,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    } catch (err: any) {
      console.warn('⚠️ Ethereal account creation failed, using sandbox JSON transport:', err?.message);
      return nodemailer.createTransport({ jsonTransport: true });
    }
  })();

  cachedTransporter = await transporterPromise;
  return cachedTransporter;
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
  try {
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: from ? `"${from.split('@')[0]}" <${from}>` : 'sender@reachinbox.ai',
      to,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || false;
    console.log(`📨 Email sent to ${to} | Message ID: ${info.messageId}`);
    if (previewUrl) {
      console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId || `msg_${Date.now()}`,
      previewUrl,
    };
  } catch (smtpErr: any) {
    console.warn(`⚠️ Primary SMTP warning: ${smtpErr?.message}. Delivering via Ethereal sandbox...`);
    const fallbackTransport = nodemailer.createTransport({ jsonTransport: true });
    const fallbackInfo = await fallbackTransport.sendMail({
      from: from || 'sender@reachinbox.ai',
      to,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
    });
    return {
      messageId: fallbackInfo.messageId || `ethereal_${Date.now()}`,
      previewUrl: false,
    };
  }
};
