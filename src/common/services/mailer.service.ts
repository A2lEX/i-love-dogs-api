import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private resend: Resend;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('MailerService initialized with Resend');
    } else {
      this.logger.warn('RESEND_API_KEY not found. Emails will not be sent.');
    }
  }

  async sendContactForm(data: { name: string; email: string; message: string }) {
    if (!this.resend) {
      this.logger.error('Resend is not configured. Skipping email.');
      return false;
    }

    const to = 'info@tailo.org';
    const from = 'Tailo <onboarding@resend.dev>'; // Resend requires verified domain or onboarding@resend.dev
    const subject = `New Contact Form Message from ${data.name}`;
    
    const html = `
      <h3>New Contact Message</h3>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Message:</strong></p>
      <p>${data.message}</p>
    `;

    try {
      const result = await this.resend.emails.send({
        from,
        to,
        subject,
        html,
        reply_to: data.email,
      });

      if (result.error) {
        this.logger.error(`Resend error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      this.logger.log(`Email sent successfully via Resend. ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to} via Resend`, error.stack);
      throw error;
    }
  }
}
