(()=>{
  if(window.__KHGRQ&&document.getElementById('kh-groq')){
    document.getElementById('kh-groq').style.display='block';
    return;
  }

  let key=prompt('Cole sua chave da API Groq:');
  if(!key)return;
  key=key.trim();

  const SOLVERS=[
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
  ];

  const VERIFIERS=[
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
  ];

  const cooldowns={};

  const box=document.createElement('div');
  box.id='kh-groq';
  box.style='position:fixed;right:8px;top:8px;width:min(290px,calc(100vw - 16px));z-index:2147483647;background:#fff;color:#111;border:2px solid #1865f2;border-radius:12px;padding:10px;font:13px Arial;box-shadow:0 4px 18px #0006;max-height:46vh;overflow:auto';

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

    let x=bx+e.clientX-sx;
    let y=by+e.clientY-sy;

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
  top.onpointercancel=()=>drag=false;

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
    const root=
      document.querySelector(
        '[data-testid="content-library-content-panel"]'
      ) ||
      document.querySelector(
        'main,[role="main"]'
      ) ||
      document.body;

    const a=[];
    const seen=new Set();

    const w=document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    while(w.nextNode()){
      const e=w.currentNode.parentElement;

      if(
        !e ||
        e.closest('#kh-groq') ||
        ['SCRIPT','STYLE','NOSCRIPT']
          .includes(e.tagName)
      ){
        continue;
      }

      try{
        const c=getComputedStyle(e);

        if(
          c.display==='none' ||
          c.visibility==='hidden'
        ){
          continue;
        }
      }catch{}

      add(
        a,
        seen,
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
          seen,
          e.getAttribute?.('aria-label') ||
          e.getAttribute?.('alt') ||
          e.getAttribute?.('title') ||
          e.textContent
        );
      });

    return a
      .join('\n')
      .slice(0,14000);
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
    const linhas=
      texto
        .split('\n')
        .map(x=>x.trim())
        .filter(Boolean);

    const mapa={};

    for(
      let i=0;
      i<linhas.length;
      i++
    ){
      const m=
        linhas[i]
          .match(/^([A-F])$/);

      if(!m)continue;

      const letra=m[1];
      const partes=[];

      for(
        let j=i+1;
        j<linhas.length &&
        j<=i+5;
        j++
      ){
        if(
          /^[A-F]$/.test(
            linhas[j]
          )
        ){
          break;
        }

        if(
          /^(verificar|pular|relatar|dicas|escolha|conferir)/i
            .test(linhas[j])
        ){
          break;
        }

        partes.push(
          linhas[j]
        );
      }

      if(partes.length){
        mapa[letra]=
          partes.join(' ');
      }
    }

    return mapa;
  }

  function inferirLetra(
    resposta,
    mapa
  ){
    const direta=
      String(resposta||'')
        .match(
          /^\s*([A-F])\b/i
        );

    if(direta){
      return direta[1]
        .toUpperCase();
    }

    const a=
      canon(resposta);

    if(a.length<2){
      return '';
    }

    for(
      const [letra,texto]
      of Object.entries(mapa)
    ){
      const b=canon(texto);

      if(
        a.length>=2 &&
        b.length>=2 &&
        (
          b.includes(a) ||
          a.includes(b)
        )
      ){
        return letra;
      }
    }

    return '';
  }

  function parseRetrySeconds(msg){
    const m=
      String(msg||'')
        .match(
          /try again in\s*(\d+(?:\.\d+)?)s/i
        );

    return m
      ? Math.ceil(
          Number(m[1])
        )
      : 60;
  }

  async function chamar(
    model,
    promptTxt
  ){
    if(
      cooldowns[model] &&
      Date.now()<cooldowns[model]
    ){
      const left=
        Math.ceil(
          (
            cooldowns[model]-
            Date.now()
          )/1000
        );

      const er=
        new Error(
          'limite temporário ('+
          left+
          's)'
        );

      er.rate=true;

      throw er;
    }

    const ctrl=
      new AbortController();

    const timer=
      setTimeout(
        ()=>ctrl.abort(),
        35000
      );

    try{
      const body={
        model,

        messages:[
          {
            role:'user',
            content:promptTxt
          }
        ],

        max_completion_tokens:
          model.includes('qwen')
            ? 500
            : 900,

        temperature:.1
      };

      if(
        model.includes('qwen')
      ){
        body.reasoning_effort=
          'low';

        body.reasoning_format=
          'hidden';
      }else{
        body.reasoning_effort=
          'low';

        body.include_reasoning=
          false;
      }

      const r=
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

            signal:ctrl.signal
          }
        );

      const j=
        await r
          .json()
          .catch(()=>({}));

      if(!r.ok){
        const msg=
          j?.error?.message ||
          (
            'Erro HTTP '+
            r.status
          );

        const er=
          new Error(msg);

        er.status=r.status;

        if(r.status===429){
          er.rate=true;

          cooldowns[model]=
            Date.now()+
            (
              parseRetrySeconds(
                msg
              )+2
            )*1000;
        }

        throw er;
      }

      const t=
        j?.choices?.[0]
          ?.message
          ?.content
          ?.trim();

      if(!t){
        throw new Error(
          'resposta vazia'
        );
      }

      return t;

    }finally{
      clearTimeout(timer);
    }
  }

  function parseResposta(
    texto,
    mapa
  ){
    const resposta=
      (
        texto.match(
          /RESPOSTA\s*:\s*([^\n]+)/i
        ) || []
      )[1]?.trim() || '';

    const valorTxt=
      (
        texto.match(
          /VALOR\s*:\s*([^\n]+)/i
        ) || []
      )[1]?.trim() || '';

    const explicacao=
      (
        texto.match(
          /EXPLICA[CÇ][AÃ]O\s*:\s*([\s\S]*)/i
        ) || []
      )[1]?.trim() || '';

    const letra=
      inferirLetra(
        resposta,
        mapa
      );

    let valor=null;

    if(
      valorTxt &&
      !/^(n\/a|na|null|vazio|nenhum)$/i
        .test(valorTxt)
    ){
      const m=
        valorTxt
          .replace(',','.')
          .match(
            /-?\d+(?:\.\d+)?/
          );

      if(m){
        const n=
          Number(m[0]);

        if(
          Number.isFinite(n)
        ){
          valor=n;
        }
      }
    }

    const keyNorm=
      letra
        ? 'L:'+letra
        : 'T:'+
          canon(resposta)
            .slice(0,120);

    return {
      resposta,
      letra,
      valor,
      explicacao,
      key:keyNorm,
      raw:texto
    };
  }

  function parseVerificacao(
    texto,
    mapa
  ){
    const veredito=
      (
        texto.match(
          /VEREDITO\s*:\s*([^\n]+)/i
        ) || []
      )[1]?.trim()
        .toUpperCase() || '';

    const resposta=
      (
        texto.match(
          /RESPOSTA\s*:\s*([^\n]+)/i
        ) || []
      )[1]?.trim() || '';

    const valorTxt=
      (
        texto.match(
          /VALOR\s*:\s*([^\n]+)/i
        ) || []
      )[1]?.trim() || '';

    const expr=
      (
        texto.match(
          /EXPRESSAO\s*:\s*([^\n]+)/i
        ) || []
      )[1]?.trim() || '';

    const explicacao=
      (
        texto.match(
          /EXPLICA[CÇ][AÃ]O\s*:\s*([\s\S]*)/i
        ) || []
      )[1]?.trim() || '';

    const letra=
      inferirLetra(
        resposta,
        mapa
      );

    let valor=null;

    if(
      valorTxt &&
      !/^(n\/a|na|null|vazio|nenhum)$/i
        .test(valorTxt)
    ){
      const m=
        valorTxt
          .replace(',','.')
          .match(
            /-?\d+(?:\.\d+)?/
          );

      if(m){
        const n=
          Number(m[0]);

        if(
          Number.isFinite(n)
        ){
          valor=n;
        }
      }
    }

    const keyNorm=
      letra
        ? 'L:'+letra
        : 'T:'+
          canon(resposta)
            .slice(0,120);

    return {
      veredito,
      resposta,
      letra,
      valor,
      expr,
      explicacao,
      key:keyNorm,
      raw:texto
    };
  }

  function tokenize(expr){
    const s=
      String(expr||'')
        .toLowerCase()
        .replace(/,/g,'.')
        .replace(/π/g,'pi')
        .replace(/√/g,'sqrt');

    const tokens=[];
    let i=0;

    while(i<s.length){
      const ch=s[i];

      if(/\s/.test(ch)){
        i++;
        continue;
      }

      if(/[0-9.]/.test(ch)){
        let j=i+1;

        while(
          j<s.length &&
          /[0-9.]/.test(s[j])
        ){
          j++;
        }

        const num=
          s.slice(i,j);

        if(
          !/^\d*\.?\d+$/
            .test(num)
        ){
          throw new Error(
            'número inválido'
          );
        }

        tokens.push({
          t:'num',
          v:Number(num)
        });

        i=j;

        continue;
      }

      if(/[a-z]/.test(ch)){
        let j=i+1;

        while(
          j<s.length &&
          /[a-z]/.test(s[j])
        ){
          j++;
        }

        tokens.push({
          t:'id',
          v:s.slice(i,j)
        });

        i=j;

        continue;
      }

      if(
        '+-*/^()'.includes(ch)
      ){
        tokens.push({
          t:ch,
          v:ch
        });

        i++;
        continue;
      }

      throw new Error(
        'caractere inválido'
      );
    }

    return tokens;
  }

  function calcular(expr){
    if(
      !expr ||
      /^(n\/a|na|null|vazio|nenhum)$/i
        .test(
          String(expr).trim()
        )
    ){
      return null;
    }

    let tokens;

    try{
      tokens=tokenize(expr);
    }catch{
      return null;
    }

    let pos=0;

    const peek=
      ()=>tokens[pos];

    const take=t=>
      peek()?.t===t
        ? tokens[pos++]
        : null;

    function parseExpression(){
      let v=parseTerm();

      while(true){
        if(take('+')){
          v+=parseTerm();
        }else if(take('-')){
          v-=parseTerm();
        }else{
          break;
        }
      }

      return v;
    }

    function parseTerm(){
      let v=parsePower();

      while(true){
        if(take('*')){
          v*=parsePower();
        }else if(take('/')){
          v/=parsePower();
        }else{
          break;
        }
      }

      return v;
    }

    function parsePower(){
      let v=parseUnary();

      if(take('^')){
        v=Math.pow(
          v,
          parsePower()
        );
      }

      return v;
    }

    function parseUnary(){
      if(take('+')){
        return parseUnary();
      }

      if(take('-')){
        return -parseUnary();
      }

      return parsePrimary();
    }

    function parsePrimary(){
      const n=take('num');

      if(n){
        return n.v;
      }

      const id=take('id');

      if(id){
        if(id.v==='pi'){
          return Math.PI;
        }

        if(!take('(')){
          throw new Error(
            'função sem parênteses'
          );
        }

        const arg=
          parseExpression();

        if(!take(')')){
          throw new Error(
            'parêntese faltando'
          );
        }

        const rad=
          arg*Math.PI/180;

        switch(id.v){
          case 'sqrt':
            return Math.sqrt(arg);

          case 'sin':
            return Math.sin(rad);

          case 'cos':
            return Math.cos(rad);

          case 'tan':
            return Math.tan(rad);

          case 'asin':
            return (
              Math.asin(arg)*
              180/Math.PI
            );

          case 'acos':
            return (
              Math.acos(arg)*
              180/Math.PI
            );

          case 'atan':
            return (
              Math.atan(arg)*
              180/Math.PI
            );

          default:
            throw new Error(
              'função não permitida'
            );
        }
      }

      if(take('(')){
        const v=
          parseExpression();

        if(!take(')')){
          throw new Error(
            'parêntese faltando'
          );
        }

        return v;
      }

      throw new Error(
        'expressão inválida'
      );
    }

    try{
      const v=
        parseExpression();

      if(
        pos!==tokens.length
      ){
        return null;
      }

      return Number.isFinite(v)
        ? v
        : null;

    }catch{
      return null;
    }
  }

  function respostaConcreta(
    o,
    mapa
  ){
    const r=
      String(
        o.resposta||''
      ).trim();

    if(
      !r ||
      /^(n\/a|na|null|nenhum|vazio|não sei|nao sei)$/i
        .test(r)
    ){
      return false;
    }

    if(
      /^[A-F]$/i.test(r)
    ){
      return true;
    }

    if(
      /[=≈]\s*$/i.test(r)
    ){
      return false;
    }

    const temNumero=
      /\d/.test(r);

    const temRaiz=
      /√|sqrt/i.test(r);

    const temTextoFinal=
      /\b(cm|m|km|graus?|°|%|anos?|horas?|minutos?|segundos?|verdadeiro|falso|sim|não|nao)\b/i
        .test(r);

    const pareceFormulaGenerica=
      /\b[a-z]\s*=|\b[a-z]\^?2\b|\ba\b.*\bb\b.*\bcos\b/i
        .test(r) &&
      !temNumero &&
      !temRaiz;

    if(pareceFormulaGenerica){
      return false;
    }

    if(
      o.letra &&
      mapa[o.letra]
    ){
      return true;
    }

    return (
      temNumero ||
      temRaiz ||
      temTextoFinal ||
      r.length>=2
    );
  }

  async function resolverIA(
    model,
    nome,
    promptTxt,
    mapa
  ){
    let ultimo='';
    let pedido=promptTxt;

    for(
      let tentativa=1;
      tentativa<=2;
      tentativa++
    ){
      try{
        status.textContent=
          nome+
          ' — tentativa '+
          tentativa+
          '/2...';

        const txt=
          await chamar(
            model,
            pedido
          );

        const parsed=
          parseResposta(
            txt,
            mapa
          );

        if(
          !respostaConcreta(
            parsed,
            mapa
          )
        ){
          ultimo=
            'resposta incompleta/genérica';

          pedido=
            promptTxt+
            '\n\nSua resposta anterior não trouxe um resultado final concreto. Resolva até o fim e dê a resposta final.';

          continue;
        }

        return {
          ok:true,
          ...parsed
        };

      }catch(e){
        if(e?.rate){
          return {
            ok:false,
            rate:true,
            error:e.message
          };
        }

        ultimo=
          e?.message ||
          'erro';

        if(
          e?.status===401 ||
          e?.status===403
        ){
          break;
        }

        if(tentativa===1){
          await new Promise(
            r=>setTimeout(
              r,
              700
            )
          );
        }
      }
    }

    return {
      ok:false,
      error:ultimo
    };
  }

  async function verificarIndependente(
    question,
    candidato,
    mapa
  ){
    const prompt=
      'Você é o verificador independente. '+
      'Ignore qualquer raciocínio anterior e resolva a questão do zero usando somente os dados da QUESTÃO. '+
      'Depois compare com a RESPOSTA CANDIDATA. '+
      'Se houver matemática, reconstrua a expressão a partir dos dados da questão; não copie conta do candidato. '+
      'Use exatamente cinco linhas:\n'+
      'VEREDITO: OK ou ERRO\n'+
      'RESPOSTA: [resposta correta]\n'+
      'VALOR: [valor decimal correto, ou N/A]\n'+
      'EXPRESSAO: [expressão que calcula VALOR usando apenas números e + - * / ^, parênteses, sqrt, sin, cos, tan, asin, acos, atan; ou N/A]\n'+
      'EXPLICAÇÃO: [no máximo 2 frases simples]\n'+
      'Trigonometria usa graus. Não use LaTeX.\n\n'+
      'QUESTÃO:\n'+
      question+
      '\n\nRESPOSTA CANDIDATA:\n'+
      candidato;

    let ultimo='';

    for(
      const model
      of VERIFIERS
    ){
      try{
        status.textContent=
          'Verificando de forma independente...';

        const txt=
          await chamar(
            model,
            prompt
          );

        const v=
          parseVerificacao(
            txt,
            mapa
          );

        if(
          !v.resposta ||
          !v.veredito
        ){
          throw new Error(
            'verificação incompleta'
          );
        }

        let mathOK=null;

        if(
          v.valor!=null &&
          v.expr &&
          !/^(n\/a|na|null|vazio|nenhum)$/i
            .test(v.expr)
        ){
          const calc=
            calcular(v.expr);

          if(calc!=null){
            const tol=
              Math.max(
                .05,
                Math.abs(v.valor)*
                .015
              );

            mathOK=
              Math.abs(
                calc-v.valor
              )<=tol;
          }
        }

        return {
          ok:true,
          ...v,
          mathOK,
          model
        };

      }catch(e){
        ultimo=
          e?.message ||
          'erro';

        if(
          e?.status===401 ||
          e?.status===403
        ){
          break;
        }
      }
    }

    retu
