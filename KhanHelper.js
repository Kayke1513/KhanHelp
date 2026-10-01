(()=>{
if(window.__KHGRQ&&document.getElementById('kh-groq')){
document.getElementById('kh-groq').style.display='block';
return
}

let key=prompt('Cole sua chave da API Groq:');
if(!key)return;
key=key.trim();

const MODELS=[
'qwen/qwen3.8-27b',
'openai/gpt-oss-120b',
'openai/gpt-oss-20b'
];

let box=document.createElement('div');
box.id='kh-groq';
box.style='position:fixed;right:8px;bottom:8px;width:min(290px,calc(100vw - 16px));z-index:2147483647;background:#fff;color:#111;border:2px solid #1865f2;border-radius:12px;padding:10px;font:13px Arial;box-shadow:0 4px 18px #0006;max-height:43vh;overflow:auto';

let top=document.createElement('div');
top.innerHTML='<b>📘 Khan Helper</b>';

let close=document.createElement('button');
close.textContent='✕';
close.style='float:right;border:0;background:#eee;border-radius:6px;padding:3px 8px;font-size:15px';
top.appendChild(close);

let res=document.createElement('div');
res.style='margin:9px 0;white-space:pre-wrap;line-height:1.4';
res.textContent='🤔 Analisando...';

let status=document.createElement('div');
status.style='font-size:10px;color:#777;margin-bottom:6px';

let btn=document.createElement('button');
btn.textContent='🔄 Atualizar';
btn.style='width:100%;padding:9px;border:0;border-radius:8px;background:#1865f2;color:#fff;font-weight:bold;font-size:14px';

box.append(top,res,status,btn);
document.body.appendChild(box);

const add=(a,s,x)=>{
x=(x||'').replace(/\s+/g,' ').trim();

if(
x &&
x.length>1 &&
!s.has(x)
){
s.add(x);
a.push(x);
}
};

function pegar(){

let root=
document.querySelector('[data-testid="content-library-content-panel"]')
||
document.querySelector('main,[role="main"]')
||
document.body;

let a=[];
let s=new Set();

let w=document.createTreeWalker(
root,
NodeFilter.SHOW_TEXT
);

while(w.nextNode()){

let e=w.currentNode.parentElement;

if(
!e ||
e.closest('#kh-groq') ||
['SCRIPT','STYLE','NOSCRIPT'].includes(e.tagName)
){
continue;
}

try{

let c=getComputedStyle(e);

if(
c.display==='none' ||
c.visibility==='hidden'
){
continue;
}

}catch{}

add(
a,
s,
w.currentNode.textContent
);

}

root.querySelectorAll(
'[aria-label],[alt],[title],svg text,svg tspan,svg title,svg desc'
)
.forEach(e=>{

if(
e.closest &&
e.closest('#kh-groq')
){
return;
}

add(
a,
s,
e.getAttribute?.('aria-label')
||
e.getAttribute?.('alt')
||
e.getAttribute?.('title')
||
e.textContent
);

});

return a
.join('\n')
.slice(0,14000);

}

async function chamar(
model,
promptTxt
){

let ctrl=
new AbortController();

let timer=
setTimeout(
()=>ctrl.abort(),
20000
);

try{

let r=
await fetch(
'https://api.groq.com/openai/v1/chat/completions',
{
method:'POST',

headers:{
'Content-Type':'application/json',
'Authorization':'Bearer '+key
},

body:JSON.stringify({
model:model,

messages:[
{
role:'user',
content:promptTxt
}
],

temperature:.2,
max_completion_tokens:260
}),

signal:ctrl.signal
}
);

let j=
await r
.json()
.catch(()=>({}));

if(!r.ok){

let er=
new Error(
j?.error?.message
||
('Erro HTTP '+r.status)
);

er.status=r.status;

throw er;
}

let t=
j?.choices?.[0]
?.message
?.content
?.trim();

if(!t){

throw new Error(
'A IA não devolveu resposta.'
);

}

return t;

}finally{

clearTimeout(timer);

}

}

function extrair(txt){

let m=
String(txt||'')
.match(
/RESPOSTA\s*:\s*([^\n]+)/i
);

return(
m
?m[1]
:String(txt||'').split('\n')[0]||''
).trim();

}

function partes(ans){

let s=
String(ans||'')
.trim();

let m=
s.match(
/^([A-F])(?:\s*[-–—:.)]\s*|\s+)(.+)$/i
);

return{
letra:
m
?m[1].toUpperCase()
:'',

texto:
m
?m[2].trim()
:s
};

}

function canon(s){

return String(s||'')
.toLowerCase()
.normalize('NFD')
.replace(/[\u0300-\u036f]/g,'')
.replace(/√/g,'sqrt')
.replace(/\\sqrt/g,'sqrt')
.replace(
/\b(centimetros?|centímetros?|cm|metros?|m|quilometros?|quilômetros?|km|graus?|degrees?|°)\b/g,
''
)
.replace(/\s+/g,'')
.replace(/[^a-z0-9.+\-*/=]/g,'');

}

function concordam(a,b){

if(!a||!b)return false;

let A=partes(a);
let B=partes(b);

if(
A.letra &&
B.letra
){
return A.letra===B.letra;
}

let ca=canon(A.texto);
let cb=canon(B.texto);

return(
!!ca &&
ca===cb
);

}

function explicacao(txt){

let m=
String(txt||'')
.match(
/EXPLICA[CÇ][AÃ]O\s*:\s*([\s\S]*)/i
);

return m
?m[1].trim()
:'';

}

async function tentar(
model,
p,
nome
){

status.textContent=
'Consultando '+nome+'...';

try{

return{
ok:true,
txt:await chamar(model,p),
nome
};

}catch(e){

if(
e.status===401 ||
e.status===403
){
throw e;
}

return{
ok:false,
erro:e,
nome
};

}

}

async function resolver(){

btn.disabled=true;

btn.textContent=
'⏳ Analisando...';

res.textContent=
'🤔 Duas IAs estão resolvendo...';

status.textContent='';

let q=pegar();

if(!q){

res.textContent=
'❌ Não consegui ler a questão.';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;

}

let p=

'Resolva SOMENTE a questão escolar atual abaixo. '+

'Trabalhe de forma independente. '+

'Leia descrições de figuras, gráficos, fórmulas e alternativas. '+

'Se houver cálculo, resolva até o resultado final, refaça a conta uma segunda vez e só então responda. '+

'Não chute e não pare em fórmula genérica. '+

'Se for múltipla escolha, informe a letra e o conteúdo da alternativa. '+

'Responda em português muito simples e curto. '+

'Use exatamente este formato:\n'+

'RESPOSTA: [alternativa, valor ou resposta]\n'+

'EXPLICAÇÃO: [explicação simples em no máximo 2 frases]\n\n'+

'QUESTÃO:\n'+q;

let a;
let b;
let c;

try{

a=
await tentar(
MODELS[0],
p,
'IA 1'
);

b=
await tentar(
MODELS[1],
p,
'IA 2'
);

}catch(e){

res.textContent=
'❌ A chave Groq não foi aceita. Confira ou gere uma nova.';

status.textContent='';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;

}

let va=
a.ok
?extrair(a.txt)
:'';

let vb=
b.ok
?extrair(b.txt)
:'';

if(
a.ok &&
b.ok &&
concordam(va,vb)
){

res.textContent=
'✅ RESPOSTA CONFIRMADA: '+
va+
'\nEXPLICAÇÃO: '+
(
explicacao(a.txt)
||
explicacao(b.txt)
||
'Duas IAs chegaram à mesma resposta.'
);

status.textContent=
'✓ IA 1 e IA 2 concordaram';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;

}

res.textContent=
'🤔 IA 3 está conferindo...';

try{

c=
await tentar(
MODELS[2],
p,
'IA 3'
);

}catch(e){

res.textContent=
'❌ A chave Groq não foi aceita. Confira ou gere uma nova.';

status.textContent='';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;

}

let vc=
c.ok
?extrair(c.txt)
:'';

let win=null;
let src=null;

if(
a.ok &&
c.ok &&
concordam(va,vc)
){

win=va;
src=a;

}else if(
b.ok &&
c.ok &&
concordam(vb,vc)
){

win=vb;
src=b;

}else if(
a.ok &&
b.ok &&
concordam(va,vb)
){

win=va;
src=a;

}

if(win){

res.textContent=
'✅ RESPOSTA CONFIRMADA: '+
win+
'\nEXPLICAÇÃO: '+
(
explicacao(src.txt)
||
'Pelo menos duas IAs chegaram à mesma resposta.'
);

status.textContent=
'✓ Pelo menos 2 de 3 IAs concordaram';

}else{

res.textContent=
'⚠️ RESPOSTA NÃO CONFIRMADA\n'+
'IA 1: '+
(
a.ok
?va
:'falhou'
)+
'\nIA 2: '+
(
b.ok
?vb
:'falhou'
)+
'\nIA 3: '+
(
c.ok
?vc
:'falhou'
);

status.textContent=
'As respostas não bateram. Melhor não confiar nesta tentativa.';

}

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

}

btn.onclick=resolver;

let obs=
new MutationObserver(()=>{

if(
window.__KHGRQ &&
!document.getElementById(
'kh-groq'
) &&
document.body
){

document.body.appendChild(
box
);

}

});

obs.observe(
document.documentElement,
{
childList:true,
subtree:true
}
);

close.onclick=()=>{

obs.disconnect();

box.remove();

delete window.__KHGRQ;

};

window.__KHGRQ={

show:()=>{

box.style.display='block';

}

};

resolver();

})();
