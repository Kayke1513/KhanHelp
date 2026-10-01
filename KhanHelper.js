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

'Authorization':
'Bearer '+key

},

body:
JSON.stringify(body),

signal:
ctrl.signal

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

er.status=
r.status;

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


/* RESOLVER */

async function resolver(){

btn.disabled=true;

btn.textContent=
'⏳ Analisando...';

res.textContent=
'🤔 Pensando...';

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

'A questão pode ser de qualquer matéria. '+

'Leia com atenção o enunciado, alternativas, números, fórmulas, descrições de figuras e gráficos. '+

'Se houver cálculo, faça a conta até o RESULTADO FINAL. '+

'Não pare em fórmula genérica. '+

'Não responda N/A se houver informação suficiente para resolver. '+

'Confira a resposta antes de enviar. '+

'Se for múltipla escolha, informe a LETRA e a RESPOSTA. '+

'Se for questão aberta, informe diretamente o resultado que deve ser colocado no campo. '+

'Responda em português muito simples e curto. '+

'Use exatamente este formato:\n'+

'RESPOSTA: [letra e resposta, ou resultado final]\n'+

'EXPLICAÇÃO: [explicação simples em no máximo 2 frases]\n\n'+

'QUESTÃO:\n'+q;


for(
let i=0;
i<MODELS.length;
i++
){

let model=
MODELS[i];

let nome=
NOMES[i];


status.textContent=
'Tentando '+nome+'...';


try{

let ans=
await chamar(
model,
p
);

res.textContent=
ans;

status.textContent=
'✓ '+nome;

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;


}catch(e){


/* CHAVE INVÁLIDA */

if(
e.status===401 ||
e.status===403
){

res.textContent=
'❌ A chave Groq não foi aceita. Confira ou gere uma nova.';

status.textContent='';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;

}


/* LIMITE TEMPORÁRIO */

if(
e.status===429
){

status.textContent=
'↪ '+nome+
' está temporariamente no limite. Tentando outra IA...';

continue;

}


/* TIMEOUT */

if(
e.name==='AbortError'
){

status.textContent=
'↪ '+nome+
' demorou demais. Tentando outra IA...';

continue;

}


/* BLOQUEIO DE REDE */

if(
String(e.message)
.includes('Failed to fetch')
){

res.textContent=
'❌ O navegador bloqueou a conexão direta com a Groq.';

status.textContent='';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

return;

}


/* QUALQUER OUTRO ERRO */

status.textContent=
'↪ '+nome+
' falhou. Tentando outra IA...';

}

}


res.textContent=
'❌ Nenhuma IA respondeu agora. Aguarde um pouco e toque em Atualizar.';

status.textContent='';

btn.disabled=false;

btn.textContent=
'🔄 Atualizar';

}


/* BOTÃO */

btn.onclick=
resolver;


/* MANTÉM A JANELA NA PÁGINA */

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


/* FECHAR */

close.onclick=()=>{

obs.disconnect();

box.remove();

delete window.__KHGRQ;

};


window.__KHGRQ={

show:()=>{

box.style.display=
'block';

}

};


resolver();

})();
