import nodemailer, { Transporter } from 'nodemailer';

let transporterPromise: Promise<Transporter> | null = null;

const getTransporter = async (): Promise<Transporter> => {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      console.log('📬 Initializing Ethereal Email test account...');
      const testAccount = await nodemailer.createTestAccount();
      console.log(`✨ Ethereal Email account created: ${testAccount.user}`);

      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    })();
  }
  return transporterPromise;
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
