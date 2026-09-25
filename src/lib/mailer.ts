import nodemailer from "nodemailer";

let transporterPromise: ReturnType<typeof nodemailer.createTransport> extends infer T ? Promise<T> : never;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      })
    ) as any;
  }
  return transporterPromise;
}

export async function sendEmail(to: string, subject: string, text: string) {
  const transporter = await getTransporter();
  const info = await (transporter as any).sendMail({
    from: '"PropAPI" <no-reply@propapi.test>',
    to,
    subject,
    text,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl };
}
