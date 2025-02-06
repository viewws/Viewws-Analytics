import { EVENT_TYPE } from 'lib/constants';
import { PRISMA, runQuery } from 'lib/db';
import prisma from 'lib/prisma';
import { QueryFilters, WebsiteEventMetric } from 'lib/types';

export async function getClicksCount(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<WebsiteEventMetric[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
  });
}

async function relationalQuery(websiteId: string, filters: QueryFilters) {
  const { timezone = 'utc', unit = 'day' } = filters;
  const { rawQuery, getDateSQL, parseFilters } = prisma;
  const { filterQuery, joinSession, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: EVENT_TYPE.customEvent,
  });

  return rawQuery(
    `
    select
      'click' AS x,
      ${getDateSQL('website_event.created_at', unit, timezone)} t,
      count(*) y
    from website_event
    ${joinSession}
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and event_type = {{eventType}}
      and event_name in ('Social Link Click', 'Custom Link Click')
      ${filterQuery}
    group by 1, 2
    order by 2
    `,
    params,
  );
}
