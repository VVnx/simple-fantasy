import { authorizeBriefingPublish } from '@/lib/briefing-auth';
import { BriefingError, readBriefingText, validateBriefingDate, validateBriefingTitle } from '@/lib/briefings';
import { getBriefingView, saveBriefing } from '@/lib/data/briefings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'};

function failure(error: unknown) {
  const known = error instanceof BriefingError;
  // Do not log incoming headers, credentials, or unpublished text.
  if (!known) console.error('[briefings] Storage operation failed');
  return Response.json({error:known ? error.message : '简报暂时无法读取或保存，请稍后重试。'}, {
    status:known ? error.status : 503,
    headers:{...headers, ...(known && error.status === 401 ? {'WWW-Authenticate':'Bearer'} : {})},
  });
}

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get('date');
    const view = await getBriefingView(date === null ? undefined : validateBriefingDate(date));
    return Response.json(view, {headers});
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    authorizeBriefingPublish(request);
    const params = new URL(request.url).searchParams;
    const date = validateBriefingDate(params.get('date') ?? '');
    const title = validateBriefingTitle(params.get('title'));
    const content = await readBriefingText(request);
    const briefing = await saveBriefing(date, title, content);
    return Response.json({date:briefing.date, title:briefing.title, updatedAt:briefing.updatedAt}, {headers});
  } catch (error) { return failure(error); }
}
