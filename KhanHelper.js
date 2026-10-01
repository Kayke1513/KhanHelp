(()=>{
  if(window.__KHGRQ&&document.getElementById('kh-groq')){
    document.getElementById('kh-groq').style.display='block';
    return;
  }

  let key=prompt('Cole sua chave da API Groq:');
  if(!key)return;
  key=key.trim();

  const MODELS=[
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ];

  const cooldowns={};

  const box=document.createElement('div');
  box.id='kh-groq';
  box.style='position:fixed;right:8px;top:8px;width:min(290px,calc(100vw - 16px));z-index:2147483647;background:#fff;color:#111;border:2px solid #1865f2;border-radius:12px;padding:10px;font:13px Arial;box-shadow:0 4px 18px #0006;max-height:45vh;overflow:auto';

  const top=document.createElement('div');
  top.innerHTML='<b>📘 Khan Helper</b>';
  top.style='touch-action:none;user-select:none;cursor:move;padding:4px 2px';

  const close=document.createElement('button');
  close.textContent='✕';
  close.style='float:right;border:0;background:#eee;border-radius:6px;padding:3px 8px;font-size:15px;cursor:pointer';
  top.appendChild(close);

  const res=document.createElement('div');
  res.style='margin:9px 0;white-space:pre-wrap;line-height:1.4';
  res.textContent='🤔 Pronto para analisar...';

  const status=document.createElement('div');
  status.style='font-size:10px;color:#777;margin-bottom:6px';

  const btn=document.createElement('button');
  btn.textContent='🔄 Resolver questão';
  btn.style='width:100%;padding:9px;border:0;border-radius:8px;background:#1865f2;color:#fff;font-weight:bold;font-size:14px;cursor:pointer';

  box.append(top,res,status,btn);
  document.body.appendChild(box);

  let drag=false,sx=0,sy=0,bx=0,by=0;
  top.onpointerdown=e=>{
    if(e.target===close)return;
    drag=true;
    const r=box.getBoundingClientRect();
    sx=e.clientX;sy=e.clientY;bx=r.left;by=r.top;
    box.style.left=bx+'px';
    box.style.top=by+'px';
    box.style.right='auto';
    box.style.bottom='auto';
    top.setPointerCapture?.(e.pointerId);
  };
  top.onpointermove=e=>{
    if(!drag)return;
    let x=bx+e.clientX-sx;
    let y=by+e.clientY-sy;
    x=Math.max(4,Math.min(x,innerWidth-box.offsetWidth-4));
    y=Math.max(4,Math.min(y,innerHeight-box.offsetHeight-4));
    box.style.left=x+'px';
    box.style.top=y+'px';
  };
  top.onpointerup=top.onpointercancel=()=>drag=false;

  const add=(a,s,x)=>{
    x=(x||'').replace(/\s+/g,' ').trim();
    if(x&&x.length>1&&!s.has(x)){
      s.add(x);
      a.push(x);
    }
  };

  function pegar(){
    const root=document.querySelector('[data-testid="content-library-content-panel"]')||document.querySelector('main,[role="main"]')||document.body;
    const a=[];
    const seen=new Set();
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);

    while(w.nextNode()){
      const e=w.currentNode.parentElement;
      if(!e||e.closest('#kh-groq')||['SCRIPT','STYLE','NOSCRIPT'].includes(e.tagName))continue;
      try{
        const c=getComputedStyle(e);
        if(c.display==='none'||c.visibility==='hidden')continue;
      }catch{}
      add(a,seen,w.currentNode.textContent);
    }

    root.querySelectorAll('[aria-label],[alt],[title],svg text,svg tspan,svg title,svg desc').forEach(e=>{
      if(e.closest&&e.closest('#kh-groq'))return;
      add(a,seen,e.getAttribute?.('aria-label')||e.getAttribute?.('alt')||e.getAttribute?.('title')||e.textContent);
    });

    return a.join('\n').slice(0,14000);
  }

  function canon(t){
    return String(t||'')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/√|\\sqrt/g,'sqrt')
      .replace(/,/g,'.')
      .replace(/\s+/g,'')
      .replace(/[^a-z0-9.+\-*/=]/g,'');
  }

  function alternativas(texto){
    const linhas=texto.split('\n').map(x=>x.trim()).filter(Boolean);
    const mapa={};
    for(let i=0;i<linhas.length;i++){
      const m=linhas[i].match(/^([A-F])$/);
      if(!m)continue;
      const letra=m[1];
      const partes=[];
      for(let j=i+1;j<linhas.length&&j<=i+5;j++){
        if(/^[A-F]$/.test(linhas[j]))break;
        if(/^(verificar|pular|relatar|dicas|escolha|conferir)/i.test(linhas[j]))break;
        partes.push(linhas[j]);
      }
      if(partes.length)mapa[letra]=partes.join(' ');
    }
    return mapa;
  }

  function inferirLetra(resposta,mapa){
    const direta=String(resposta||'').match(/^\s*([A-F])\b/i);
    if(direta)return direta[1].toUpperCase();
    const a=canon(resposta);
    if(a.length<2)return '';
    for(const [letra,texto] of Object.entries(mapa)){
      const b=canon(texto);
      if(a.length>=2&&b.length>=2&&(b.includes(a)||a.includes(b)))return letra;
    }
    return '';
  }

  function parseRetrySeconds(msg){
    const m=String(msg||'').match(/try again in\s*(\d+(?:\.\d+)?)s/i);
    return m?Math.ceil(Number(m[1])):60;
  }

  async function chamar(model,promptTxt){
    if(cooldowns[model]&&Date.now()<cooldowns[model]){
      const left=Math.ceil((cooldowns[model]-Date.now())/1000);
      const er=new Error('limite temporário ('+left+'s)');
      er.rate=true;
      throw er;
    }

    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),35000);

    try{
      const body={
        model,
        messages:[{role:'user',content:promptTxt}],
        max_completion_tokens:model.includes('qwen')?500:900,
        temperature:.15
      };

      if(model.includes('qwen')){
        body.reasoning_effort='low';
        body.reasoning_format='hidden';
      }else{
        body.reasoning_effort='low';
        body.include_reasoning=false;
      }

      const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+key
        },
        body:JSON.stringify(body),
        signal:ctrl.signal
      });

      const j=await r.json().catch(()=>({}));

      if(!r.ok){
        const msg=j?.error?.message||('Erro HTTP '+r.status);
        const er=new Error(msg);
        er.status=r.status;
        if(r.status===429){
          er.rate=true;
          const sec=parseRetrySeconds(msg);
          cooldowns[model]=Date.now()+(sec+2)*1000;
        }
        throw er;
      }

      const t=j?.choices?.[0]?.message?.content?.trim();
      if(!t)throw new Error('resposta vazia');
      return t;
    }finally{
      clearTimeout(timer);
    }
  }

  function parseResposta(texto,mapa){
    const resposta=(texto.match(/RESPOSTA\s*:\s*([^\n]+)/i)||[])[1]?.trim()||'';
    const valorTxt=(texto.match(/VALOR\s*:\s*([^\n]+)/i)||[])[1]?.trim()||'';
    const calc=(texto.match(/CALC\s*:\s*([^\n]+)/i)||[])[1]?.trim()||'';
    const explicacao=(texto.match(/EXPLICA[CÇ][AÃ]O\s*:\s*([\s\S]*)/i)||[])[1]?.trim()||'';
    const letra=inferirLetra(resposta,mapa);

    let valor=null;
    if(valorTxt&&!/^(n\/a|na|null|vazio|nenhum)$/i.test(valorTxt)){
      const m=valorTxt.replace(',','.').match(/-?\d+(?:\.\d+)?/);
      if(m){
        const n=Number(m[0]);
        if(Number.isFinite(n))valor=n;
      }
    }

    const keyNorm=letra?'L:'+letra:'T:'+canon(resposta).slice(0,120);
    return {resposta,letra,valor,calc,explicacao,key:keyNorm,raw:texto};
  }

  function tokenize(expr){
    const s=String(expr||'')
      .toLowerCase()
      .replace(/,/g,'.')
      .replace(/π/g,'pi')
      .replace(/√/g,'sqrt');
    const tokens=[];
    let i=0;
    while(i<s.length){
      const ch=s[i];
      if(/\s/.test(ch)){i++;continue;}
      if(/[0-9.]/.test(ch)){
        let j=i+1;
        while(j<s.length&&/[0-9.]/.test(s[j]))j++;
        const num=s.slice(i,j);
        if(!/^\d*\.?\d+$/.test(num))throw new Error('número inválido');
        tokens.push({t:'num',v:Number(num)});
        i=j;
        continue;
      }
      if(/[a-z]/.test(ch)){
        let j=i+1;
        while(j<s.length&&/[a-z]/.test(s[j]))j++;
        tokens.push({t:'id',v:s.slice(i,j)});
        i=j;
        continue;
      }
      if('+-*/^(),'.includes(ch)){
        tokens.push({t:ch,v:ch});
        i++;
        continue;
      }
      throw new Error('caractere inválido');
    }
    return tokens;
  }

  function calcular(expr){
    if(!expr||/^(n\/a|na|null|vazio|nenhum)$/i.test(String(expr).trim()))return null;

    let tokens;
    try{tokens=tokenize(expr);}catch{return null;}
    let pos=0;

    const peek=()=>tokens[pos];
    const take=t=>{
      if(peek()?.t===t)return tokens[pos++];
      return null;
    };

    function parseExpression(){
      let v=parseTerm();
      while(true){
        if(take('+'))v+=parseTerm();
        else if(take('-'))v-=parseTerm();
        else break;
      }
      return v;
    }

    function parseTerm(){
      let v=parsePower();
      while(true){
        if(take('*'))v*=parsePower();
        else if(take('/'))v/=parsePower();
        else break;
      }
      return v;
    }

    function parsePower(){
      let v=parseUnary();
      if(take('^'))v=Math.pow(v,parsePower());
      return v;
    }

    function parseUnary(){
      if(take('+'))return parseUnary();
      if(take('-'))return -parseUnary();
      return parsePrimary();
    }

    function parsePrimary(){
      const n=take('num');
      if(n)return n.v;

      const id=take('id');
      if(id){
        if(id.v==='pi')return Math.PI;
        if(!take('('))throw new Error('função sem parênteses');
        const arg=parseExpression();
        if(!take(')'))throw new Error('parêntese faltando');
        const rad=arg*Math.PI/180;
        switch(id.v){
          case 'sqrt': return Math.sqrt(arg);
          case 'sin': return Math.sin(rad);
          case 'cos': return Math.cos(rad);
          case 'tan': return Math.tan(rad);
          case 'asin': return Math.asin(arg)*180/Math.PI;
          case 'acos': return Math.acos(arg)*180/Math.PI;
          case 'atan': return Math.atan(arg)*180/Math.PI;
          default: throw new Error('função não permitida');
        }
      }

      if(take('(')){
        const v=parseExpression();
        if(!take(')'))throw new Error('parêntese faltando');
        return v;
      }

      throw new Error('expressão inválida');
    }

    try{
      const v=parseExpression();
      if(pos!==tokens.length)return null;
      return Number.isFinite(v)?v:null;
    }catch{
      return null;
    }
  }

  function conferirMatematica(o){
    if(o.valor==null||!o.calc||/^(n\/a|na|null|vazio|nenhum)$/i.test(o.calc))return null;
    const calculado=calcular(o.calc);
    if(calculado==null)return null;
    const tol=Math.max(.05,Math.abs(o.valor)*.015);
    return Math.abs(calculado-o.valor)<=tol;
  }

  function respostaConcreta(o,mapa){
    const r=String(o.resposta||'').trim();
    if(!r||/^(n\/a|na|null|nenhum|vazio|não sei|nao sei)$/i.test(r))return false;
    if(/^[A-F]$/i.test(r))return true;
    if(/[=≈]\s*$/i.test(r))return false;

    const temNumero=/\d/.test(r);
    const temRaiz=/√|sqrt/i.test(r);
    const temTextoFinal=/\b(cm|m|km|graus?|°|%|anos?|horas?|minutos?|segundos?|verdadeiro|falso|sim|não|nao)\b/i.test(r);
    const pareceFormulaGenerica=/\b[a-z]\s*=|\b[a-z]\^?2\b|\ba\b.*\bb\b.*\bcos\b/i.test(r)&&!temNumero&&!temRaiz;

    if(pareceFormulaGenerica)return false;
    if(o.letra&&mapa[o.letra])return true;
    return temNumero||temRaiz||temTextoFinal||r.length>=2;
  }

  async function resolverIA(model,nome,promptTxt,mapa){
    let ultimo='';
    let pedido=promptTxt;

    for(let tentativa=1;tentativa<=2;tentativa++){
      try{
        status.textContent=nome+' — tentativa '+tentativa+'/2...';
        const txt=await chamar(model,pedido);
        const parsed=parseResposta(txt,mapa);

        if(!respostaConcreta(parsed,mapa)){
          ultimo='resposta incompleta/genérica';
          pedido=promptTxt+'\n\nSua resposta anterior não trouxe um resultado final concreto. Resolva até o fim. Não responda N/A e não pare em fórmula genérica.';
          continue;
        }

        const math=conferirMatematica(parsed);
        if(math===false){
          ultimo='a conta não bateu';
          pedido=promptTxt+'\n\nA conta anterior não bateu com o valor final. Refaça do zero e corrija.';
          continue;
        }

        return {ok:true,...parsed,math};
      }catch(e){
        if(e?.rate)return {ok:false,rate:true,error:e.message};
        ultimo=e?.message||'erro';
        if(e?.status===401||e?.status===403)break;
        if(tentativa===1)await new Promise(r=>setTimeout(r,700));
      }
    }

    return {ok:false,error:ultimo};
  }

  function textoResultado(o){
    if(o?.ok)return o.resposta;
    if(o?.rate)return o.error||'limite temporário';
    return 'falhou ('+(o?.error||'erro desconhecido')+')';
  }

  function respostaBonita(o,mapa){
    if(o.letra&&mapa[o.letra]){
      const txt=mapa[o.letra];
      const cr=canon(o.resposta);
      if(cr===canon(o.letra)||cr.length<=2)return o.letra+' — '+txt;
    }
    return o.resposta;
  }

  function mostrarConfirmada(o,mapa,msg){
    res.textContent='✅ RESPOSTA CONFIRMADA: '+respostaBonita(o,mapa)+'\n\nEXPLICAÇÃO: '+(o.explicacao||'Duas verificações chegaram à mesma resposta.');
    status.textContent=msg;
  }

  function mesmaResposta(a,b){
    if(!a?.ok||!b?.ok)return false;
    if(a.key===b.key)return true;
    if(a.letra&&b.letra&&a.letra===b.letra)return true;
    return canon(a.resposta)===canon(b.resposta);
  }

  async function resolver(){
    btn.disabled=true;
    btn.textContent='⏳ Analisando...';
    res.textContent='🤔 IA 1 e IA 2 estão resolvendo...';
    status.textContent='';

    const q=pegar();
    if(!q){
      res.textContent='❌ Não consegui ler a questão.';
      btn.disabled=false;
      btn.textContent='🔄 Atualizar';
      return;
    }

    const mapa=alternativas(q);
    const p=
      'Resolva SOMENTE a questão escolar atual abaixo. Ela pode ser de qualquer matéria. '+
      'Leia descrições de imagens, gráficos, fórmulas e alternativas. '+
      'Se houver cálculo, faça até o resultado final e confira. Nunca pare em fórmula genérica. '+
      'Nunca responda N/A se a questão puder ser resolvida. '+
      'Se for múltipla escolha, RESPOSTA deve começar com a letra correta e depois a resposta. '+
      'Se for resposta aberta, escreva o resultado final concreto. '+
      'Use exatamente estas quatro linhas:\n'+
      'RESPOSTA: [letra e resposta, ou resultado final]\n'+
      'VALOR: [valor numérico decimal equivalente, ou N/A apenas se realmente não houver valor numérico]\n'+
      'CALC: [expressão matemática que reproduz VALOR, ou N/A se a questão não for matemática]\n'+
      'EXPLICAÇÃO: [explicação simples em no máximo 2 frases]\n'+
      'Em CALC use apenas números, + - * / ^, parênteses, sqrt, sin, cos, tan, asin, acos e atan. Trigonometria usa graus. '+
      'Para resposta simbólica como √13, mantenha √13 em RESPOSTA, use VALOR aproximadamente 3.6055 e CALC sqrt(13). '+
      'Não use LaTeX.\n\nQUESTÃO:\n'+q;

    const [ia1,ia2]=await Promise.all([
      resolverIA(MODELS[0],'IA 1',p,mapa),
      resolverIA(MODELS[1],'IA 2',p,mapa)
    ]);

    if(mesmaResposta(ia1,ia2)){
      const mathOK=ia1.math===true||ia2.math===true;
      mostrarConfirmada(ia1,mapa,mathOK?'✓ IA 1 e IA 2 concordaram • 🧮 conta conferida':'✓ IA 1 e IA 2 concordaram');
      btn.disabled=false;
      btn.textContent='🔄 Atualizar';
      return;
    }

    res.textContent='🤔 IA 3 está conferindo...';
    status.textContent='IA 1 e IA 2 não confirmaram a mesma resposta.';

    const ia3=await resolverIA(MODELS[2],'IA 3',p,mapa);
    const valid=[ia1,ia2,ia3].filter(x=>x.ok);

    let winner=null;
    for(let i=0;i<valid.length;i++){
      for(let j=i+1;j<valid.length;j++){
        if(mesmaResposta(valid[i],valid[j])){
          winner=[valid[i],valid[j]];
          break;
        }
      }
      if(winner)break;
    }

    if(winner){
      const mathOK=winner.some(x=>x.math===true);
      mostrarConfirmada(winner[0],mapa,mathOK?'✓ Pelo menos 2 IAs concordaram • 🧮 conta conferida':'✓ Pelo menos 2 IAs concordaram');
    }else{
      res.textContent='⚠️ RESPOSTA NÃO CONFIÁVEL\nIA 1: '+textoResultado(ia1)+'\nIA 2: '+textoResultado(ia2)+'\nIA 3: '+textoResultado(ia3);
      status.textContent='Não consegui confirmar a mesma resposta com pelo menos 2 IAs.';
    }

    btn.disabled=false;
    btn.textContent='🔄 Atualizar';
  }

  btn.onclick=resolver;

  const obs=new MutationObserver(()=>{
    if(window.__KHGRQ&&!document.getElementById('kh-groq')&&document.body){
      document.body.appendChild(box);
    }
  });

  obs.observe(document.documentElement,{childList:true,subtree:true});

  close.onclick=()=>{
    obs.disconnect();
    box.remove();
    delete window.__KHGRQ;
  };

  window.__KHGRQ={show:()=>{box.style.display='block';}};
  resolver();
})();
