import { EVENT_TYPE } from 'lib/constants';
import { PRISMA, runQuery } from 'lib/db';
import prisma from 'lib/prisma';
import { QueryFilters, LinkEventMetric } from 'lib/types';

export function getLinkClickStats(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<LinkEventMetric[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
  });
}

async function relationalQuery(websiteId: string, filters: QueryFilters) {
  const { timezone = 'utc' } = filters;
  const { rawQuery, parseFilters } = prisma;
  const { filterQuery, joinSession, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: EVENT_TYPE.customEvent,
  });

  return rawQuery(
    `
    SELECT
      we."event_name" AS event,
      ed."string_value" AS "link_url",
      COUNT(*) AS clicks
    FROM "website_event" AS we
    JOIN "event_data" AS ed
      ON ed."website_event_id" = we."event_id"
      AND ed."data_key" = 'link_url'
    ${joinSession} -- session join if needed
    WHERE
      we."website_id" = {{websiteId::uuid}}
       AND (we."created_at" AT TIME ZONE '${timezone}') BETWEEN {{startDate}} AND {{endDate}}
      AND we."event_name" IN ('Custom Link Click', 'Social Link Click')
      ${filterQuery}
    GROUP BY event, link_url
    ORDER BY clicks
    `,
    params,
  );
}
