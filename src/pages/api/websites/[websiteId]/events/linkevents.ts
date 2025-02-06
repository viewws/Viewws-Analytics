import * as yup from 'yup';
import { canViewWebsite } from 'lib/auth';
import { useAuth, useCors, useValidate } from 'lib/middleware';
import { getRequestFilters, getRequestDateRange } from 'lib/request';
import { NextApiRequestQueryBody, WebsiteAllStats } from 'lib/types';
import { NextApiResponse } from 'next';
import { methodNotAllowed, ok, unauthorized } from 'next-basics';
import { getLinkClickStats } from 'queries';
import { TimezoneTest } from 'lib/yup';

export interface WebsitePageviewRequestQuery {
  websiteId: string;
  startAt: number;
  endAt: number;
  unit?: string;
  timezone?: string;
  url?: string;
  referrer?: string;
  title?: string;
  host?: string;
  os?: string;
  browser?: string;
  device?: string;
  country?: string;
  region: string;
  city?: string;
  tag?: string;
  compare?: string;
}

const schema = {
  GET: yup.object().shape({
    websiteId: yup.string().uuid().required(),
    startAt: yup.number().required(),
    endAt: yup.number().required(),
    timezone: TimezoneTest,
    url: yup.string(),
    referrer: yup.string(),
    title: yup.string(),
    host: yup.string(),
    os: yup.string(),
    browser: yup.string(),
    device: yup.string(),
    country: yup.string(),
    region: yup.string(),
    city: yup.string(),
    tag: yup.string(),
    compare: yup.string(),
  }),
};

export default async (
  req: NextApiRequestQueryBody<WebsitePageviewRequestQuery>,
  res: NextApiResponse<WebsiteAllStats>,
) => {
  await useCors(req, res);
  await useAuth(req, res);
  await useValidate(schema, req, res);

  const { websiteId, timezone } = req.query;

  if (req.method === 'GET') {
    if (!(await canViewWebsite(req.auth, websiteId))) {
      return unauthorized(res);
    }

    const { startDate, endDate } = await getRequestDateRange(req);

    const filters = {
      ...getRequestFilters(req),
      startDate,
      endDate,
      timezone,
    };

    const data = await getLinkClickStats(websiteId, filters);
    const customLinkClicks: Array<{ x: string; y: number }> = [];
    const socialLinkClicks: Array<{ x: string; y: number }> = [];

    for (const row of data) {
      const { event, link_url, clicks } = row;

      if (event === 'Custom Link Click') {
        customLinkClicks.push({ x: link_url, y: clicks });
      } else if (event === 'Social Link Click') {
        socialLinkClicks.push({ x: link_url, y: clicks });
      }
    }

    return ok(res, {
      customLinkClicks,
      socialLinkClicks,
    });
  }

  return methodNotAllowed(res);
};
