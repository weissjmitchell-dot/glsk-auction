import {previewFeed} from '../server/msf-preview.js';
import {MsfError,validateRequest,rpc,fetchFeed} from '../server/msf.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'Use POST.'}); }
  try {
    const origin=process.env.GLSK_APP_ORIGIN || 'https://glsk-auction.vercel.app';
    if (req.headers.origin!==origin) throw new MsfError('Open GLSK at its production address.',403);
    const auth=req.headers.authorization;
    if (typeof auth!=='string' || !/^Bearer [^\s]+$/i.test(auth) || auth.length>12000) throw new MsfError('Sign in to GLSK again.',401);
    let body; try { body=typeof req.body==='string'?JSON.parse(req.body):req.body; } catch { throw new MsfError('Invalid request.',400); }
    validateRequest(body);
    if(body.action!=='test'||!['players','teams'].includes(body.feed))throw new MsfError('Choose player or team statistics for preview.',400);
    await rpc(auth,'status');
    const configured=Boolean(process.env.MSF_API_KEY?.trim());
    if (body.action==='status') return res.status(200).json({configured,importsEnabled:false});
    if (!configured) throw new MsfError('Add MSF_API_KEY in Vercel and redeploy before testing.',503);
    await rpc(auth,'claim',body.feed);
    return res.status(200).json(previewFeed(await fetchFeed(body),body));
  } catch (error) {
    const known=error instanceof MsfError;
    return res.status(known?error.status:502).json({error:known?error.message:'The feed test could not be completed. Try again later.'});
  }
}
