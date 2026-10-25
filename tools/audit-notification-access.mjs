import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const env=parseEnv(readFileSync('.dev.vars','utf8'));
console.log(JSON.stringify(Object.fromEntries(['SENDPULSE_API_KEY','SENDPULSE_CLIENT_ID','SENDPULSE_CLIENT_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','ADMIN_NOTIFICATION_EMAILS','GOOGLE_CALENDAR_ID'].map(k=>[k,Boolean(env[k])]))));
if(env.SENDPULSE_CLIENT_ID && env.SENDPULSE_CLIENT_SECRET){
 const r=await fetch('https://api.sendpulse.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:env.SENDPULSE_CLIENT_ID,client_secret:env.SENDPULSE_CLIENT_SECRET})});
 const b=await r.json(); console.log(JSON.stringify({sendpulseAuth:r.status,tokenAvailable:Boolean(b.access_token)}));
 if(r.ok&&b.access_token){const s=await fetch('https://api.sendpulse.com/senders',{headers:{Authorization:`Bearer ${b.access_token}`}});const senders=await s.json();console.log(JSON.stringify({sendersStatus:s.status,corporateSenders:Array.isArray(senders)?senders.filter(v=>v.email?.endsWith('@hundesalon-nika.com')).map(v=>({email:v.email,status:v.status})):[]}));}
}
