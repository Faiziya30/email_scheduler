import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
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
    console.error('❌ Failed to initialize Elasticsearch index:', error.message);
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
    console.error(`❌ Failed to index email ${email.id} into Elasticsearch:`, error.message);
  }
};

/**
 * Searches emails in Elasticsearch matching subject or recipient.
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
    console.error('❌ Failed to query Elasticsearch:', error.message);
    throw error;
  }
};
