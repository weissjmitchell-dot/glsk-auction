export default function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    configured:Boolean(process.env.RESEND_API_KEY && process.env.GLSK_EMAIL_FROM && process.env.GLSK_EMAIL_ENABLED === 'true')
  });
}
