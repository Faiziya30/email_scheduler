import { Request, Response, NextFunction } from 'express';
import { EmailSchedulerService } from '../services/emailScheduler.service';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

export class EmailController {
  public static async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let { recipients } = req.body;
      const { subject, body, senderEmail, startTime, delayMs, hourlyLimit } = req.body;

      // Handle CSV or text file upload if provided
      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        const parsedEmails: string[] = [];

        if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
          const stream = Readable.from(fileContent);
          await new Promise<void>((resolve, reject) => {
            stream
              .pipe(csvParser())
              .on('data', (row: Record<string, string>) => {
                // Check all columns for email pattern
                for (const key of Object.keys(row)) {
                  const val = row[key]?.trim();
                  if (val && val.includes('@')) {
                    parsedEmails.push(val);
                    break;
                  }
                }
              })
              .on('end', () => resolve())
              .on('error', reject);
          });
        } else {
          // Plain text list of emails separated by newlines/commas
          const extracted = fileContent
            .split(/[\r\n,]+/)
            .map((e) => e.trim())
            .filter((e) => e && e.includes('@'));
          parsedEmails.push(...extracted);
        }

        recipients = parsedEmails;
      } else if (typeof recipients === 'string') {
        // If passed as comma-separated or JSON string
        try {
          recipients = JSON.parse(recipients);
        } catch {
          recipients = recipients.split(',').map((e: string) => e.trim()).filter(Boolean);
        }
      }

      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Please provide at least one valid recipient email (array, comma-separated string, or CSV file).',
        });
        return;
      }

      const result = await EmailSchedulerService.scheduleBatch({
        subject,
        body,
        recipients,
        senderEmail,
        startTime,
        delayMs: delayMs ? Number(delayMs) : undefined,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
        userId: (req as any).user?.id,
      });

      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const emails = await EmailSchedulerService.getScheduledEmails(limit);
      res.status(200).json({
        status: 'success',
        results: emails.length,
        data: emails,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const emails = await EmailSchedulerService.getSentEmails(limit);
      res.status(200).json({
        status: 'success',
        results: emails.length,
        data: emails,
      });
    } catch (error) {
      next(error);
    }
  }
}
