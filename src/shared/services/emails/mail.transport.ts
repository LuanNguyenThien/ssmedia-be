import nodemailer from 'nodemailer';
import Logger from 'bunyan';
import sendGridMail from '@sendgrid/mail';
import { config } from '@root/config';
import { BadRequestError } from '@global/helpers/error-handler';

interface IMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
}

// Global error handler to catch unhandled errors
process.on('uncaughtException', (error) => {
  log.error('There was an uncaught error:', error);
  // Perform any necessary cleanup and exit the process
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Perform any necessary cleanup and exit the process
  process.exit(1);
});

const log: Logger = config.createLogger('mailOptions');
sendGridMail.setApiKey(config.SENDGRID_API_KEY!);

class MailTransport {
  public async sendEmail(receiverEmail: string, subject: string, body: string): Promise<void> {
    if (config.NODE_ENV === 'test' || config.NODE_ENV === 'development') {
      console.log('developmentEmailSender');
      await this.developmentEmailSender(receiverEmail, subject, body);
    } else {
      console.log('productionEmailSender');
      await this.productionEmailSender(receiverEmail, subject, body);
    }
  }

  private async developmentEmailSender(receiverEmail: string, subject: string, body: string): Promise<void> {
   // Remove spaces from app password if any
    const appPassword = config.SENDER_EMAIL_PASSWORD!.replace(/\s+/g, '');

    const transporter: nodemailer.Transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.SENDER_EMAIL!,
        pass: appPassword
      },
    });

    // Verify the connection configuration
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (error) {
      console.error('SMTP connection verification failed:', error);
      log.error('SMTP connection verification failed:', error);
      throw new Error('Failed to connect to email server');
    }

    const mailOptions: IMailOptions = {
      from: `Brainet Agent <${config.SENDER_EMAIL!}>`,
      to: receiverEmail,
      subject,
      html: body
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        await transporter.sendMail(mailOptions);
        log.info('Development email sent successfully.');
        break;
      } catch (error) {
        if (error instanceof Error && (error as any).code === 'ECONNRESET' && attempts < maxAttempts - 1) {
          attempts++;
          log.warn(`Attempt ${attempts} failed. Retrying...`);
        } else {
          log.error('Error sending email', error);
          throw new Error('Error sending email');
        }
      }
    }
  }

  private async productionEmailSender(receiverEmail: string, subject: string, body: string): Promise<void> {
    const mailOptions: IMailOptions = {
      from: `Brainet Agent <${config.SENDER_EMAIL!}>`,
      to: receiverEmail,
      subject,
      html: body
    };

    try {
      await sendGridMail.send(mailOptions);
      log.info('Production email sent successfully.');
    } catch (error) {
      log.error('Error sending email', error);
      throw new BadRequestError('Error sending email');
    }
  }
}

export const mailTransport: MailTransport = new MailTransport();
