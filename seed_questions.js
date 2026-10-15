require('dotenv').config(); const db = require('../config/db');
const Q = [
 ['aptitude','Percentages','A price rises from 200 to 250. What is the percentage increase?','25'],
 ['aptitude','Time & Work','A finishes a job in 10 days, B in 15 days. Days to finish together?','6'],
 ['aptitude','Series','Next number: 2, 6, 12, 20, 30, ?','42'],
 ['technical','SQL','Explain the difference between INNER JOIN and LEFT JOIN.','matching,rows,null,left table,all'],
 ['technical','OOP','Explain polymorphism with an example.','method,override,overload,runtime,same name'],
 ['technical','DBMS','What is normalization and why is it used?','redundancy,anomaly,table,dependency'],
 ['technical','Data Structures','Difference between a stack and a queue?','lifo,fifo,push,pop,enqueue,dequeue'],
 ['hr','Self','Tell me about yourself.','education,project,skill,goal,internship'],
 ['hr','Strengths','What is your biggest weakness and how are you handling it?','improve,learn,example,feedback,practice'],
 ['hr','Teamwork','Describe a time you worked in a team and resolved a conflict.','team,communicate,result,listen,task']];
(async () => {
  const [[{ n }]] = await db.query('SELECT COUNT(*) n FROM prep_questions');
  if (!n) for (const q of Q) await db.query('INSERT INTO prep_questions(category,topic,question,keywords) VALUES(?,?,?,?)', q);
  console.log('Questions ready'); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
