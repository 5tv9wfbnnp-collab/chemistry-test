import fs from 'node:fs';
import {questions,VERSION} from '../server/core.mjs';
const publicQuestions=questions.map(({id,line,topic,image,answer})=>({id,line,topic,image,length:answer.length}));
fs.writeFileSync('public/questions.json',JSON.stringify({version:VERSION,questions:publicQuestions}));
if(questions.length!==24||new Set(questions.map(q=>q.id)).size!==24)throw Error('Неверный состав теста');
for(const q of questions)if(!fs.existsSync('public'+q.image))throw Error('Нет изображения '+q.id);
console.log('24 задания. Публичные файлы созданы без ключей и источников.');
