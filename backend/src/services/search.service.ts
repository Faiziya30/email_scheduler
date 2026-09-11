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

let isElasticsearchAvailable = false;

/**
 * Initializes the Elasticsearch 'emails' index with explicit mappings on application startup.
 */
export const initElasticsearchIndex = async (): Promise<void> => {
  try {
    const exists = await Promise.race([
      esClient.indices.exists({ index: EMAILS_INDEX }),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('ES ping timeout')), 1000)),
    ]);

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
    isElasticsearchAvailable = true;
  } catch (error: any) {
    isElasticsearchAvailable = false;
    console.warn('⚠️ Elasticsearch not reachable. Search will use instant PostgreSQL engine.');
  }
};

/**
 * Upserts an email document into the Elasticsearch 'emails' index.
 */
export const indexEmail = async (email: EmailDocument): Promise<void> => {
  if (!isElasticsearchAvailable) return;
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
    });
    console.log(`🔍 Indexed email ${email.id} into Elasticsearch (status: ${email.status})`);
  } catch (error: any) {
    isElasticsearchAvailable = false;
    console.warn(`⚠️ Skipping Elasticsearch indexing for email ${email.id}`);
  }
};

/**
 * Searches emails in Elasticsearch matching subject, recipient, or body.
 * Seamlessly falls back to PostgreSQL ILIKE query if Elasticsearch is offline.
 */
export const searchEmails = async (queryText: string, userId?: string) => {
  if (isElasticsearchAvailable) {
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

      return response.hits.hits.map((hit) => {
        const source = (hit._source || {}) as EmailDocument;
        return {
          _id: hit._id,
          score: hit._score,
          ...source,
          id: source.id || hit._id,
        };
      });
    } catch (error: any) {
      isElasticsearchAvailable = false;
    }
  }

  // Instant PostgreSQL database search
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
    console.error('❌ Database search fallback failed:', dbErr.message);
    return [];
  }
};

