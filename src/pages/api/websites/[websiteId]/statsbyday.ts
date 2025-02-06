import * as yup from 'yup';
import { NextApiResponse } from 'next';
import { methodNotAllowed, ok, unauthorized } from 'next-basics';
import { canViewWebsite } from 'lib/auth';
import { useAuth, useCors, useValidate } from 'lib/middleware';
import { NextApiRequestQueryBody, WebsiteStatsByDayResponse } from 'lib/types';
import { getRequestFilters, getRequestDateRange } from 'lib/request';
import { getCompareDate } from 'lib/date';

// Make sure you have implemented getWebsiteStatsByDay
// in your "queries" folder or similar location.
import { getWebsiteStatsByDay } from 'queries';

export interface WebsiteStatsByDayRequestQuery {
  websiteId: string;
  startAt: number;
  endAt: number;
  url?: string;
  referrer?: string;
  title?: string;
  query?: string;
  event?: string;
  host?: string;
  os?: string;
  browser?: string;
  device?: string;
  country?: string;
  region?: string;
  city?: string;
  tag?: string;
  compare?: string;
  timezone?: string;
}

const schema = {
  GET: yup.object().shape({
    websiteId: yup.string().uuid().required(),
    startAt: yup.number().required(),
    endAt: yup.number().required(),
    url: yup.string(),
    referrer: yup.string(),
    title: yup.string(),
    query: yup.string(),
    event: yup.string(),
    host: yup.string(),
    os: yup.string(),
    browser: yup.string(),
    device: yup.string(),
    country: yup.string(),
    region: yup.string(),
    city: yup.string(),
    tag: yup.string(),
    compare: yup.string(),
    timezone: yup.string(),
  }),
};

export default async (
  req: NextApiRequestQueryBody<WebsiteStatsByDayRequestQuery>,
  res: NextApiResponse<WebsiteStatsByDayResponse>,
) => {
  await useCors(req, res);
  await useAuth(req, res);
  await useValidate(schema, req, res);

  const { websiteId, compare, timezone } = req.query;

  if (req.method === 'GET') {
    if (!(await canViewWebsite(req.auth, websiteId))) {
      return unauthorized(res);
    }

    const { startDate, endDate } = await getRequestDateRange(req);
    const { startDate: compareStartDate, endDate: compareEndDate } = getCompareDate(
      compare,
      startDate,
      endDate,
    );

    const filters = getRequestFilters(req);

    const currentData = await getWebsiteStatsByDay(websiteId, {
      ...filters,
      startDate,
      endDate,
      timezone,
    });

    const previousData = await getWebsiteStatsByDay(websiteId, {
      ...filters,
      startDate: compareStartDate,
      endDate: compareEndDate,
    });

    return ok(res, {
      current: currentData,
      previous: previousData,
    });
  }

  return methodNotAllowed(res);
};
