import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
export const questions=JSON.parse(fs.readFileSync(new URL('./questions.json',import.meta.url),'utf8'));
export const VERSION=createHash('sha256').update(JSON.stringify(questions)).digest('hex').slice(0,16);
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const equal=(a,b)=>timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
export function sign(payload,secret){const p=Buffer.from(JSON.stringify(payload)).toString('base64url');return p+'.'+createHmac('sha256',secret).update(p).digest('base64url');}
export function verify(value,secret,role){try{const [p,s,...rest]=value.split('.');if(rest.length||!equal(s,createHmac('sha256',secret).update(p).digest('base64url')))return null;const v=JSON.parse(Buffer.from(p,'base64url'));return v.role===role&&v.exp>Date.now()?v:null;}catch{return null;}}
export function cleanAnswers(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Неверный формат ответов.');
 if(Object.keys(input).some(k=>!questions.some(q=>q.id===k)))throw Error('Неизвестное задание.');
 const out={};for(const q of questions){const s=input[q.id]??'';if(typeof s!=='string'||!/^\d{0,12}$/.test(s))throw Error('В ответах допустимы только цифры.');out[q.id]=s;}return out;
}
export function grade(input){const answers=cleanAnswers(input);const items=questions.map(q=>{
 const actual=answers[q.id];const sorted=s=>[...s].sort().join('');
 let points=(q.unordered?sorted(actual)===sorted(q.answer):actual===q.answer)?q.max:0;
 if(q.max===2&&actual.length===q.answer.length&&[...actual].filter((c,i)=>c!==q.answer[i]).length===1)points=1;
 return {id:q.id,line:q.line,topic:q.topic,answer:actual,expected:q.answer,points,max:q.max};
 });const topics={};for(const i of items){const t=topics[i.topic]??={points:0,max:0,correct:0,total:0};t.points+=i.points;t.max+=i.max;t.correct+=Number(i.points===i.max);t.total++;}
 return {points:items.reduce((s,i)=>s+i.points,0),max:items.reduce((s,i)=>s+i.max,0),items,topics};}
