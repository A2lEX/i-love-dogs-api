import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    // For local development or production with sendmail installed
    this.transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail',
    });
  }

  async sendContactForm(data: { name: string; email: string; message: string }) {
    const to = 'info@tailo.org';
    const subject = `New Contact Form Message from ${data.name}`;
    
    const html = `
      <h3>New Contact Message</h3>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Message:</strong></p>
      <p>${data.message}</p>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Tailo Contact Form" <${this.configService.get('SENDGRID_FROM_EMAIL', 'noreply@tailo.org')}>`,
        to,
        subject,
        html,
        replyTo: data.email,
      });
      this.logger.log(`Email sent to ${to} from ${data.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      throw error;
    }
  }
}
