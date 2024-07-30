import * as yup from 'yup';
import { canViewWebsite } from 'lib/auth';
import { useAuth, useCors, useValidate } from 'lib/middleware';
import { NextApiRequestQueryBody, PageParams } from 'lib/types';
import { NextApiResponse } from 'next';
import { methodNotAllowed, ok, unauthorized } from 'next-basics';
import { pageInfo } from 'lib/schema';
import { getWebsiteSessions } from 'queries';

export interface ReportsRequestQuery extends PageParams {
  websiteId: string;
}

const schema = {
  GET: yup.object().shape({
    websiteId: yup.string().uuid().required(),
    ...pageInfo,
  }),
};

export default async (
  req: NextApiRequestQueryBody<ReportsRequestQuery, any>,
  res: NextApiResponse,
) => {
  await useCors(req, res);
  await useAuth(req, res);
  await useValidate(schema, req, res);

  const { websiteId } = req.query;

  if (req.method === 'GET') {
    if (!(await canViewWebsite(req.auth, websiteId))) {
      return unauthorized(res);
    }

    const data = await getWebsiteSessions(websiteId, {}, req.query);

    return ok(res, data);
  }

  return methodNotAllowed(res);
};
