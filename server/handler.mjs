import {randomBytes} from 'node:crypto';
import {VERSION,questions,hash,equal,sign,verify,cleanAnswers,grade} from './core.mjs';
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export function handler(repo,env){return async(request,context={})=>{
 const reply=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
 try{
 if(!env.DATABASE_URL||env.TEACHER_SECRET?.length<32||env.SESSION_SECRET?.length<32||!env.TEACHER_SECRET||!env.SESSION_SECRET)return reply(503,{error:'Сервис ещё не настроен.'});
 const url=new URL(request.url),op=url.pathname.split('/').filter(Boolean).at(-1),method=request.method;
 if(!['GET','POST'].includes(method))return reply(405,{error:'Метод недоступен.'});
 if(method==='POST'&&(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json')))return reply(403,{error:'Запрос отклонён.'});
 const cookies=Object.fromEntries((request.headers.get('cookie')||'').split(';').map(s=>s.trim().split('=')));
 const teacher=verify(cookies.teacher||'',env.SESSION_SECRET,'teacher');
 const student=verify(cookies.student||'',env.SESSION_SECRET,'student');
 let body={};if(method==='POST'){const raw=await request.text();if(raw.length>16000)return reply(413,{error:'Слишком большой запрос.'});try{body=JSON.parse(raw);}catch{return reply(400,{error:'Некорректный запрос.'});}}
 if(op==='login'&&method==='POST'){
  const ip=hash((context.ip||'unknown')+env.SESSION_SECRET);
  if(!await repo.limit('teacher:'+ip))return reply(429,{error:'Много попыток. Подождите 15 минут.'});
  if(typeof body.secret!=='string'||!equal(body.secret,env.TEACHER_SECRET))return reply(401,{error:'Неверный секрет.'});
  return reply(200,{ok:true},{'Set-Cookie':cookie('teacher',sign({role:'teacher',exp:Date.now()+8*3600000},env.SESSION_SECRET),28800)});
 }
 if(op==='logout'&&method==='POST')return reply(200,{ok:true},{'Set-Cookie':cookie('teacher','',0)});
 if(op==='invitations'&&method==='POST'){
  if(!teacher)return reply(401,{error:'Войдите в кабинет.'});
  const label=typeof body.label==='string'?body.label.trim().slice(0,80):'';
  if(!label)return reply(400,{error:'Укажите обозначение попытки.'});
  const code=randomBytes(32).toString('base64url');const id=await repo.invite(hash(code),label);return reply(201,{code,id});
 }
 if(op==='results'&&method==='GET'){
  if(!teacher)return reply(401,{error:'Войдите в кабинет.'});
  const all=await repo.results();return reply(200,{results:all.slice(0,200),hasMore:all.length>200,questions,version:VERSION});
 }
 if(op==='start'&&method==='POST'){
  if(!await repo.limit('student:'+hash((context.ip||'unknown')+env.SESSION_SECRET)))return reply(429,{error:'Много попыток. Подождите 15 минут.'});
  if(typeof body.code!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(body.code))return reply(401,{error:'Проверьте код доступа.'});
  const id=await repo.start(hash(body.code));if(!id)return reply(401,{error:'Проверьте код доступа.'});
  return reply(200,{ok:true},{'Set-Cookie':cookie('student',sign({id,role:'student',exp:Date.now()+30*86400000},env.SESSION_SECRET),2592000)});
 }
 if(['status','draft','submit'].includes(op)){
  if(!student)return reply(401,{error:'Введите код доступа.'});
  const state=await repo.state(student.id);if(!state)return reply(401,{error:'Попытка не найдена.'});
  if(op==='status'&&method==='GET')return reply(200,{...state,version:VERSION});
  if(op==='draft'&&method==='POST'){
   if(state.submitted)return reply(409,{error:'Работа уже отправлена.'});
   if(body.version!==VERSION)return reply(409,{error:'Тест обновлён. Перезагрузите страницу.'});
   let a;try{a=cleanAnswers(body.answers);}catch(e){return reply(400,{error:e.message});}await repo.draft(student.id,a);return reply(200,{ok:true});
  }
  if(op==='submit'&&method==='POST'){
   if(state.submitted)return reply(200,{submitted:true});
   if(body.version!==VERSION)return reply(409,{error:'Тест обновлён. Перезагрузите страницу.'});
   let a;try{a=cleanAnswers(body.answers);}catch(e){return reply(400,{error:e.message});}
   await repo.submit(student.id,VERSION,a,grade(a));return reply(200,{submitted:true});
  }
 }
 return reply(404,{error:'Страница не найдена.'});
 }catch{return reply(503,{error:'Не удалось связаться с хранилищем. Черновик остаётся на устройстве. Повторите позже.'});}
};}
