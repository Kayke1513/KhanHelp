(()=>{
if(window.__KHGRQ&&document.getElementById('kh-groq')){
document.getElementById('kh-groq').style.display='block';
return
}

let key=prompt('Cole sua chave da API Groq:');
if(!key)return;
key=key.trim();

const MODELS=[
'openai/gpt-oss-120b',
'openai/gpt-oss-20b',
'qwen/qwen3.8-27b'
];

const NOMES=['IA 1','IA 2','IA 3'];

let box=document.createElement('div');

box.id='kh-groq';

box.style=
'position:fixed;right:8px;top:8px;width:min(290px,calc(100vw - 16px));z-index:2147483647;background:#fff;color:#111;border:2px solid #1865f2;border-radius:12px;padding:10px;font:13px Arial;box-shadow:0 4px 18px #0006;max-height:43vh;overflow:auto';

let top=document.createElement('div');

top.innerHTML='<b>📘 Khan Helper</b>';

top.style=
'touch-action:none;user-select:none;cursor:move;padding:3px 2px';

let close=document.createElement('button');

close.textContent='✕';

close.style=
'float:right;border:0;background:#eee;border-radius:6px;padding:3px 8px;font-size:15px';

top.appendChild(close);

let res=document.createElement('div');

res.style=
'margin:9px 0;white-space:pre-wrap;line-height:1.4';

res.textContent='🤔 Analisando...';

let status=document.createElement('div');

status.style=
'font-size:10px;color:#777;margin-bottom:6px';

let btn=document.createElement('button');

btn.textContent='🔄 Atualizar';

btn.style=
'width:100%;padding:9px;border:0;border-radius:8px;background:#1865f2;color:#fff;font-weight:bold;font-size:14px';

box.append(top,res,status,btn);

document.body.appendChild(box);


/* ARRASTAR A JANELA */

let drag=false;
let sx=0;
let sy=0;
let bx=0;
let by=0;

top.onpointerdown=e=>{

if(e.target===close)return;

drag=true;

let r=box.getBoundingClientRect();

sx=e.clientX;
sy=e.clientY;

bx=r.left;
by=r.top;

box.style.left=bx+'px';
box.style.top=by+'px';

box.style.right='auto';
box.style.bottom='auto';

top.setPointerCapture?.(e.pointerId);

};

top.onpointermove=e=>{

if(!drag)return;

let x=
bx+e.clientX-sx;

let y=
by+e.clientY-sy;

x=Math.max(
4,
Math.min(
x,
innerWidth-box.offsetWidth-4
)
);

y=Math.max(
4,
Math.min(
y,
innerHeight-box.offsetHeight-4
)
);

box.style.left=x+'px';
box.style.top=y+'px';

};

top.onpointerup=
top.onpointercancel=
()=>drag=false;


/* CAPTURA DA QUESTÃO */

const add=(a,s,x)=>{

x=(x||'')
.replace(/\s+/g,' ')
.trim();

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

document.querySelector(
'[data-testid="content-library-content-panel"]'
)

||

document.querySelector(
'main,[role="main"]'
)

||

document.body;

let a=[];
let s=new Set();

let w=document.createTreeWalker(
root,
NodeFilter.SHOW_TEXT
);

while(w.nextNode()){

let e=
w.currentNode.parentElement;

if(
!e ||
e.closest('#kh-groq') ||
['SCRIPT','STYLE','NOSCRIPT']
.includes(e.tagName)
){

continue;

}

try{

let c=
getComputedStyle(e);

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

root
.querySelectorAll(
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


/* CHAMADA PARA GROQ */

async function chamar(
model,
promptTxt
){

let ctrl=
new AbortController();

let timer=
setTimeout(
()=>ctrl.abort(),
30000
);

try{

let body={

model:model,

messages:[
{
role:'user',
content:promptTxt
}
],

temperature:.1,

max_completion_tokens:
model.includes('qwen')
? 500
: 1200

};


/* GPT-OSS */

if(
model.includes('gpt-oss')
){

body.reasoning_effort=
'low';

body.include_reasoning=
false;

}


/* QWEN */

if(
model.includes('qwen')
){

body.reasoning_effort=
'low';

body.reasoning_format=
'hidden';

}


let r=
await fetch(

'https://api.groq.com/openai/v1/chat/completions',

{

method:'POST',

headers:{

'Content-Type':
'application/json',

'
