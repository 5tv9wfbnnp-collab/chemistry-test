import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {repository} from '../server/repository.mjs';
import {handler} from '../server/handler.mjs';
import {questions,VERSION,grade,hash,sign,verify} from '../server/core.mjs';
test('Баллы: порядок, перестановки, частичный балл и лишние символы',()=>{
 const answers=Object.fromEntries(questions.map(q=>[q.id,q.answer]));assert.equal(grade(answers).points,29);
 const q=questions.find(q=>q.unordered);answers[q.id]=[...q.answer].reverse().join('');assert.equal(grade(answers).points,29);
 const match=questions.find(q=>q.line===8);answers[match.id]='9'+match.answer.slice(1);assert.equal(grade(answers).points,28);
 answers[match.id]=match.answer+'1';assert.equal(grade(answers).points,27);
 assert.throws(()=>grade({q01:123}));assert.throws(()=>grade({evil:'1'}));
});
test('Подписанные сессии не допускают подмену роли или истёкший срок',()=>{
 const s='s'.repeat(32),t=sign({role:'student',exp:Date.now()+10000},s);
 assert(verify(t,s,'student'));assert.equal(verify(t,s,'teacher'),null);assert.equal(verify(t+'x',s,'student'),null);assert.equal(verify(sign({role:'teacher',exp:0},s),s,'teacher'),null);
});
test('Полный API с PostgreSQL: доступ, черновик, единичная отправка, изоляция',async()=>{
 const db=new PGlite();await db.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const sql=async(strings,...values)=>{let query=strings[0];values.forEach((v,i)=>query+='$'+(i+1)+strings[i+1]);return (await db.query(query,values)).rows;};
 const repo=repository(sql),env={DATABASE_URL:'test',TEACHER_SECRET:'t'.repeat(32),SESSION_SECRET:'s'.repeat(32)},app=handler(repo,env);
 const call=async(op,body,c='')=>app(new Request('https://test.example/api/'+op,{method:body?'POST':'GET',headers:{origin:'https://test.example','content-type':'application/json',cookie:c},body:body?JSON.stringify(body):undefined}),{ip:'127.0.0.1'});
 assert.equal((await call('results')).status,401);assert.equal((await call('invitations',{label:'x'})).status,401);
 const login=await call('login',{secret:env.TEACHER_SECRET});assert.equal(login.status,200);const tc=login.headers.get('set-cookie').split(';')[0];assert(login.headers.get('set-cookie').includes('HttpOnly'));
 const invitation=await (await call('invitations',{label:'Проверка'},tc)).json();assert.equal(invitation.code.length,43);
 const start=await call('start',{code:invitation.code});const sc=start.headers.get('set-cookie').split(';')[0];
 const state=await(await call('status',undefined,sc)).json();assert.equal(state.submitted,false);
 const answers=Object.fromEntries(questions.map(q=>[q.id,q.answer]));
 assert.equal((await call('draft',{answers,version:VERSION},sc)).status,200);
 assert.deepEqual((await(await call('status',undefined,sc)).json()).draft,answers);
 const responses=await Promise.all(Array.from({length:8},(_,i)=>call('submit',{answers:i===0?answers:{},version:VERSION},sc)));
 for(const r of responses){assert.deepEqual(await r.json(),{submitted:true});}
 assert.equal((await db.query('SELECT * FROM submissions')).rows.length,1);
 const saved=(await db.query('SELECT * FROM submissions')).rows[0];assert.deepEqual(saved.answers,answers);
 assert.equal((await call('draft',{answers:{},version:VERSION},sc)).status,409);
 assert.equal((await call('results',undefined,sc)).status,401);
 const status=await(await call('status',undefined,sc)).json();assert.equal(status.submitted,true);assert(!('report' in status));
 const results=await(await call('results',undefined,tc)).json();assert.equal(results.results.length,1);assert.equal(results.results[0].report.points,29);
 const other=await(await call('invitations',{label:'Вторая'},tc)).json();const s2=await call('start',{code:other.code});assert.equal((await(await call('status',undefined,s2.headers.get('set-cookie').split(';')[0])).json()).submitted,false);
 const foreign=await app(new Request('https://test.example/api/login',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({secret:env.TEACHER_SECRET})}));assert.equal(foreign.status,403);
 for(let i=0;i<20;i++)await call('login',{secret:'wrong'});assert.equal((await call('login',{secret:env.TEACHER_SECRET})).status,429);
 await db.close();
});
test('Публичная выдача не содержит ключей, источников и года',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/questions.json',import.meta.url),'utf8'));
 for(const q of data.questions)assert.deepEqual(Object.keys(q).sort(),['id','image','length','line','topic']);
 assert.equal(data.questions.length,24);
});
