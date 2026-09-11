import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { prisma } from '../models';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  requestTimeout: 1500,
  maxRetries: 0,
});

export const EMAILS_INDEX = 'emails';

export interface EmailDocument {
  id: string;
  userId?: string;
  sender?: string;
  recipient: string;
  subject: string;
  body?: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  scheduledAt?: string | Date;
  sentAt?: string | Date | null;
}

/**
 * Initializes the Elasticsearch 'emails' index with explicit mappings on application startup.
 */
export const initElasticsearchIndex = async (): Promise<void> => {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });

    if (!exists) {
      console.log(`🔍 Creating Elasticsearch index '${EMAILS_INDEX}' with explicit mapping...`);
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            sender: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 },
              },
            },
            recipient: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 },
              },
            },
            subject: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 },
              },
            },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${EMAILS_INDEX}' created successfully.`);
    } else {
      console.log(`🔍 Elasticsearch index '${EMAILS_INDEX}' is ready.`);
    }
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch not reachable. Search will use PostgreSQL fallback:', error.message);
  }
};

/**
 * Upserts an email document into the Elasticsearch 'emails' index.
 */
export const indexEmail = async (email: EmailDocument): Promise<void> => {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        sender: email.sender,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt ? new Date(email.scheduledAt).toISOString() : null,
        sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
      },
      refresh: 'wait_for',
    });
    console.log(`🔍 Indexed email ${email.id} into Elasticsearch (status: ${email.status})`);
  } catch (error: any) {
    console.warn(`⚠️ Skipping Elasticsearch indexing for email ${email.id} (service offline)`);
  }
};

/**
 * Searches emails in Elasticsearch matching subject, recipient, or body.
 * Seamlessly falls back to PostgreSQL ILIKE query if Elasticsearch is offline.
 */
export const searchEmails = async (queryText: string, userId?: string) => {
  try {
    const shouldQueries: any[] = [
      {
        multi_match: {
          query: queryText,
          fields: ['subject^3', 'recipient^2', 'sender', 'body'],
          fuzziness: 'AUTO',
        },
      },
      {
        wildcard: {
          'recipient.keyword': {
            value: `*${queryText.toLowerCase()}*`,
            case_insensitive: true,
          },
        },
      },
      {
        wildcard: {
          'subject.keyword': {
            value: `*${queryText.toLowerCase()}*`,
            case_insensitive: true,
          },
        },
      },
    ];

    const mustQueries: any[] = [];
    if (userId) {
      mustQueries.push({ term: { userId } });
    }

    const response = await esClient.search({
      index: EMAILS_INDEX,
      query: {
        bool: {
          must: mustQueries,
          should: shouldQueries,
          minimum_should_match: 1,
        },
      },
      sort: [{ scheduledAt: { order: 'desc', unmapped_type: 'date' } }],
      size: 50,
    });

    return response.hits.hits.map((hit) => ({
      _id: hit._id,
      _score: hit._score,
      ...(hit._source as EmailDocument),
    }));
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch query failed, using PostgreSQL database search fallback...');
    
    // Database fallback
    try {
      const dbResults = await prisma.emailJob.findMany({
        where: {
          ...(userId ? { userId } : {}),
          OR: [
            { recipient: { contains: queryText, mode: 'insensitive' } },
            { subject: { contains: queryText, mode: 'insensitive' } },
            { body: { contains: queryText, mode: 'insensitive' } },
          ],
        },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      });

      return dbResults.map((job) => ({
        _id: job.id,
        id: job.id,
        userId: job.userId,
        recipient: job.recipient,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledAt: job.scheduledAt,
        sentAt: job.sentAt,
      }));
    } catch (dbErr: any) {
      console.error('❌ Database search fallback also failed:', dbErr.message);
      return [];
    }
  }
};

