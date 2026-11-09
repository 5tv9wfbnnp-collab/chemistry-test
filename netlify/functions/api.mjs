import {neon} from '@neondatabase/serverless';
import {repository} from '../../server/repository.mjs';
import {handler} from '../../server/handler.mjs';
export default async function(request,context){
 if(!process.env.DATABASE_URL)return new Response(JSON.stringify({error:'Сервис ещё не настроен.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return handler(repository(neon(process.env.DATABASE_URL)),process.env)(request,context);
}
