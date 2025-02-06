import prisma from 'lib/prisma';
import { QueryFilters } from 'lib/types';
import { runQuery, PRISMA, CLICKHOUSE } from 'lib/db';
import clickhouse from 'lib/clickhouse';
import { EVENT_TYPE } from 'lib/constants';

export async function getAllStats(
  websiteId: string,
  filters: QueryFilters,
): Promise<
  {
    x: string;
    pageviews: number;
    sessions: number;
    clicks: number;
  }[]
> {
  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, filters),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, filters),
  });
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<
  {
    x: string;
    pageviews: number;
    sessions: number;
    clicks: number;
  }[]
> {
  const { timezone = 'utc', unit = 'day' } = filters;

  const { parseFilters, getDateSQL, rawQuery } = prisma;
  const { filterQuery, joinSession, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: undefined, // <--- So we don’t filter out custom events
  });

  return rawQuery(
    `
    SELECT
      ${getDateSQL('we.created_at', unit, timezone)} AS x,

      -- Count of all events that are page views
      COUNT(*) FILTER (
        WHERE we.event_type = ${EVENT_TYPE.pageView}
      ) AS pageviews,

      -- Distinct sessions for only page view events
      COUNT(DISTINCT we.session_id) FILTER (
        WHERE we.event_type = ${EVENT_TYPE.pageView}
      ) AS sessions,

      -- Count of custom events if event_name in ('Social Link Click', 'Custom Link Click')
      COUNT(*) FILTER (
        WHERE we.event_type = ${EVENT_TYPE.customEvent}
          AND we.event_name IN ('Social Link Click', 'Custom Link Click')
      ) AS clicks

    FROM website_event we
      ${joinSession}
    WHERE
      we.website_id = {{websiteId::uuid}}
      AND we.created_at BETWEEN {{startDate}} AND {{endDate}}
      AND we.event_type IN (${EVENT_TYPE.pageView}, ${EVENT_TYPE.customEvent})
      ${filterQuery} -- other filters like url, browser, etc.
    GROUP BY 1
    ORDER BY 1
    `,
    params,
  );
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<
  {
    x: string;
    pageviews: number;
    sessions: number;
    clicks: number;
  }[]
> {
  const { timezone = 'utc', unit = 'day' } = filters;

  const { parseFilters, getDateSQL, rawQuery } = clickhouse;
  const { filterQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: undefined, // <--- so we don't limit to one type
  });

  const sql = `
    SELECT
      ${getDateSQL('created_at', unit, timezone)} AS x,
      sumIf(1, event_type = ${EVENT_TYPE.pageView}) AS pageviews,
      uniqIf(session_id, event_type = ${EVENT_TYPE.pageView}) AS sessions,
      sumIf(1, event_type = ${EVENT_TYPE.customEvent}
                  AND event_name IN ('Social Link Click', 'Custom Link Click')
            ) AS clicks
    FROM website_event
    WHERE
      website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type IN (${EVENT_TYPE.pageView}, ${EVENT_TYPE.customEvent})
      ${filterQuery}
    GROUP BY x
    ORDER BY x
  `;

  return rawQuery(sql, params);
}
