import { EVENT_TYPE } from 'lib/constants';
import { PRISMA, runQuery } from 'lib/db';
import prisma from 'lib/prisma';
import { QueryFilters } from 'lib/types';

type WebsiteStatsByDay = {
  day: Date | string; // Depending on how you want to format the day
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
};

export async function getWebsiteStatsByDay(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebsiteStatsByDay[]> {
  return runQuery({
    [PRISMA]: () => relationalQueryByDay(websiteId, filters),
    //[CLICKHOUSE]: () => clickhouseQueryByDay(websiteId, filters),
  });
}

/**
 * 1) Postgres / MySQL / etc. (relational) version
 */
async function relationalQueryByDay(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebsiteStatsByDay[]> {
  const { getTimestampDiffSQL, getDateSQL, parseFilters, rawQuery } = prisma;
  const { timezone = 'utc', unit = 'day' } = filters;
  const { filterQuery, joinSession, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: EVENT_TYPE.pageView,
  });
  const dayColumn = getDateSQL('t.min_time', unit, timezone);

  // The inner subquery groups by (day, session_id, visit_id).
  // The outer query then aggregates the results per day.
  return rawQuery(
    `
    SELECT
  ${dayColumn}                         AS "day",
  SUM(t.c)                                           AS "pageviews",
  COUNT(DISTINCT t.session_id)                       AS "visitors",
  COUNT(DISTINCT t.visit_id)                         AS "visits",
  SUM(CASE WHEN t.c = 1 THEN 1 ELSE 0 END)           AS "bounces",
  SUM(${getTimestampDiffSQL('t.min_time', 't.max_time')}) AS "totaltime"
FROM (
  -- Sub-query: group by (session_id, visit_id) only
  SELECT
    we.session_id,
    we.visit_id,
    COUNT(*)                  AS c,
    MIN(we.created_at)        AS min_time,
    MAX(we.created_at)        AS max_time
  FROM website_event AS we
    ${joinSession}  -- if parseFilters includes a join on session
  WHERE
    we.website_id = {{websiteId::uuid}}
    AND we.created_at BETWEEN {{startDate}} AND {{endDate}}
    AND we.event_type = {{eventType}}
    ${filterQuery}
  GROUP BY
    we.session_id,
    we.visit_id
) AS t
-- Outer query: do the day truncation and group
  GROUP BY 1
    ORDER BY 1
    `,
    params,
  );
}
