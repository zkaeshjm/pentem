declare module 'nodemailer' {
  export function createTransport(opts: Record<string, unknown>): {
    sendMail(opts: Record<string, unknown>): Promise<unknown>;
  };
}
