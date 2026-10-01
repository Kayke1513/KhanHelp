(() => {
  if (window.__KH5 && document.getElementById("kh5")) return;

  const apiKey = prompt("Cole sua chave da API Groq:");
  if (!apiKey) return;

  const MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b"
  ];

  const box = document.createElement("div");
  box.id = "kh5";
  box.style.cssText = `
    position:fixed;
    right:8px;
    top:8px;
    width:min(290px,calc(100vw - 16px));
    z-index:2147483647;
    background:#fff;
    color:#111;
    border:2px solid #1865f2;
    border-radius:12px;
    padding:10px;
    font:13px Arial;
    box-shadow:0 4px 18px #0006;
    max-height:45vh;
    overflow:auto
  `;

  const header = document.createElement("div");
  header.innerHTML = "<b>📘 Khan Helper</b>";
  header.style.cssText =
    "touch-action:none;user-select:none;cursor:move;padding:4px 2px";

  const close = document.createElement("button");
  close.textContent = "✕";
  close.style.cssText =
    "float:right;border:0;background:#eee;border-radius:6px;padding:3px 8px;font-size:15px";
  header.appendChild(close);

  const result = document.createElement("div");
  result.style.cssText =
    "margin:9px 0;white-space:pre-wrap;line-height:1.4";

  const status = document.createElement("div");
  status.style.cssText =
    "font-size:10px;color:#777;margin-bottom:6px";

  const update = document.createElement("button");
  update.textContent = "🔄 Atualizar";
  update.style.cssText =
    "width:100%;padding:9px;border:0;border-radius:8px;background:#1865f2;color:#fff;font-weight:bold;font-size:14px";

  box.append(header, result, status, update);
  document.body.appendChild(box);

  // Arrastar janela
  let dragging = false;
  let sx = 0, sy = 0, bx = 0, by = 0;

  header.onpointerdown = e => {
    if (e.target === close) return;

    dragging = true;

    const r = box.getBoundingClientRect();
    sx = e.clientX;
    sy = e.clientY;
    bx = r.left;
    by = r.top;

    box.style.left = bx + "px";
    box.style.top = by + "px";
    box.style.right = "auto";
    box.style.bottom = "auto";

    header.setPointerCapture?.(e.pointerId);
  };

  header.onpointermove = e => {
    if (!dragging) return;

    let x = bx + e.clientX - sx;
    let y = by + e.clientY - sy;

    x = Math.max(4, Math.min(x, innerWidth - box.offsetWidth - 4));
    y = Math.max(4, Math.min(y, innerHeight - box.offsetHeight - 4));

    box.style.left = x + "px";
    box.style.top = y + "px";
  };

  header.onpointerup =
  header.onpointercancel = () => {
    dragging = false;
  };

  function getQuestion() {
    const root =
      document.querySelector('[data-testid="content-library-content-panel"]') ||
      document.querySelector('main,[role="main"]') ||
      document.body;

    let text = root.innerText || "";

    root
      .querySelectorAll(
        "[aria-label],[alt],[title],svg text,svg tspan,svg title,svg desc"
      )
      .forEach(el => {
        if (el.closest?.("#kh5")) return;

        const value =
          el.getAttribute?.("aria-label") ||
          el.getAttribute?.("alt") ||
          el.getAttribute?.("title") ||
          el.textContent ||
          "";

        if (value.trim()) text += "\n" + value.trim();
      });

    return text.slice(0, 12000);
  }

  async function callAI(model, promptText) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey.trim()
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: promptText
              }
            ],
            temperature: 0,
            max_completion_tokens: 1800,
            response_format: {
              type: "json_object"
            }
          }),
          signal: controller.signal
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          "HTTP " +
            response.status +
            ": " +
            (data?.error?.message || "erro")
        );
      }

      const content =
        data?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("resposta vazia");
      }

      return JSON.parse(content);
    } finally {
      clearTimeout(timer);
    }
  }

  function normalize(obj) {
    const choice =
      String(obj.choice || "").trim().toUpperCase();

    const answer =
      String(obj.answer || "").trim();

    const explanation =
      String(obj.explanation || "").trim();

    const calc =
      String(obj.calc || "").trim();

    let numericAnswer = obj.numeric_answer;

    if (
      numericAnswer === null ||
      numericAnswer === undefined ||
      numericAnswer === ""
    ) {
      numericAnswer = null;
    } else {
      numericAnswer = Number(
        String(numericAnswer).replace(",", ".")
      );

      if (!Number.isFinite(numericAnswer)) {
        numericAnswer = null;
      }
    }

    const key =
      /^[A-F]$/.test(choice)
        ? "LETTER:" + choice
        : "ANSWER:" +
          answer
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "")
            .replace(",", ".");

    return {
      choice,
      answer,
      explanation,
      calc,
      numericAnswer,
      key
    };
  }

  function calculate(expression) {
    if (!expression) return null;

    let e = expression
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/π/g, "pi")
      .replace(/√\s*\(/g, "sqrt(")
      .replace(/\^/g, "**");

    if (!/^[0-9+\-*/().\s_a-z*]+$/.test(e)) {
      return null;
    }

    const allowed = [
      "sqrt",
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "atan",
      "pi"
    ];

    let check = e;

    for (const name of allowed) {
      check = check.replace(
        new RegExp("\\b" + name + "\\b", "g"),
        ""
      );
    }

    if (/[a-z_]/.test(check)) {
      return null;
    }

    e = e
      .replace(/\bpi\b/g, "Math.PI")
      .replace(/\bsqrt\b/g, "Math.sqrt")
      .replace(/\bsin\s*\(/g, "SIN(")
      .replace(/\bcos\s*\(/g, "COS(")
      .replace(/\btan\s*\(/g, "TAN(")
      .replace(/\basin\s*\(/g, "ASIN(")
      .replace(/\bacos\s*\(/g, "ACOS(")
      .replace(/\batan\s*\(/g, "ATAN(");

    const SIN = n => Math.sin(n * Math.PI / 180);
    const COS = n => Math.cos(n * Math.PI / 180);
    const TAN = n => Math.tan(n * Math.PI / 180);

    const ASIN = n => Math.asin(n) * 180 / Math.PI;
    const ACOS = n => Math.acos(n) * 180 / Math.PI;
    const ATAN = n => Math.atan(n) * 180 / Math.PI;

    try {
      const value = Function(
        "SIN",
        "COS",
        "TAN",
        "ASIN",
        "ACOS",
        "ATAN",
        "return (" + e + ")"
      )(
        SIN,
        COS,
        TAN,
        ASIN,
        ACOS,
        ATAN
      );

      return Number.isFinite(value)
        ? value
        : null;

    } catch {
      return null;
    }
  }

  function verifyMath(obj) {
    if (
      obj.numericAnswer === null ||
      !obj.calc
    ) {
      return null;
    }

    const calculated = calculate(obj.calc);

    if (calculated === null) {
      return null;
    }

    const tolerance = Math.max(
      0.05,
      Math.abs(obj.numericAnswer) * 0.015
    );

    return (
      Math.abs(
        calculated - obj.numericAnswer
      ) <= tolerance
    );
  }

  async function solveWithRetry(
    model,
    name,
    promptText
  ) {
    let lastError = "";

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        status.textContent =
          name +
          " — tentativa " +
          attempt +
          "/2...";

        const raw =
          await callAI(model, promptText);

        const answer =
          normalize(raw);

        if (!answer.answer) {
          throw new Error(
            "resposta final vazia"
          );
        }

        const mathCheck =
          verifyMath(answer);

        if (mathCheck === false) {
          lastError =
            "a conta da IA não bateu";

          continue;
        }

        return {
          ok: true,
          answer,
          mathCheck
        };

      } catch (e) {
        lastError =
          e?.message ||
          "erro desconhecido";
      }
    }

    return {
      ok: false,
      error: lastError
    };
  }

  function buildPrompt(question) {
    return `
Resolva SOMENTE a questão escolar abaixo.

Faça a resolução do zero e confira todos os cálculos.

Não chute.

Responda SOMENTE JSON válido.

Formato obrigatório:

{
  "choice": "A, B, C, D ou vazio",
  "answer": "resposta que deve aparecer para o aluno",
  "numeric_answer": 3.6055,
  "explanation": "explicação muito simples em no máximo 2 frases",
  "calc": "expressão matemática que gera numeric_answer"
}

REGRAS:

1. Se a resposta for simbólica, por exemplo sqrt(13), escreva:
   answer = "√13 cm"
   numeric_answer = 3.6055
   calc = "sqrt(13)"

2. Se a resposta for um ângulo, por exemplo 83 graus:
   answer = "83°"
   numeric_answer = 83
   calc = "asin(...)"

3. Se não houver resultado numérico:
   numeric_answer = null
   calc = ""

4. Em calc use somente:
   números
   + - * / ^
   parênteses
   sqrt
   sin
   cos
   tan
   asin
   acos
   atan

5. Trigonometria usa graus.

6. Não use LaTeX.

QUESTÃO:

${question}
`;
  }

  function displayAnswer(obj, message) {
    result.textContent =
      "✅ RESPOSTA CONFIRMADA: " +
      (obj.choice
        ? obj.choice + " — "
        : "") +
      obj.answer +
      "\n\nEXPLICAÇÃO: " +
      obj.explanation;

    status.textContent = message;
  }

  async function solve() {
    update.disabled = true;
    update.textContent =
      "⏳ Analisando...";

    result.textContent =
      "🤔 IA 1 e IA 2 resolvendo...";

    status.textContent = "";

    const question = getQuestion();

    if (!question.trim()) {
      result.textContent =
        "❌ Não consegui ler a questão.";

      update.disabled = false;
      update.textContent =
        "🔄 Atualizar";

      return;
    }

    const promptText =
      buildPrompt(question);

    const ia1 =
      await solveWithRetry(
        MODELS[0],
        "IA 1",
        promptText
      );

    const ia2 =
      await solveWithRetry(
        MODELS[1],
        "IA 2",
        promptText
      );

    if (
      ia1.ok &&
      ia2.ok &&
      ia1.answer.key ===
        ia2.answer.key
    ) {
      const mathOK =
        ia1.mathCheck === true ||
        ia2.mathCheck === true;

      displayAnswer(
        ia1.answer,
        mathOK
          ? "✓ IA 1 e IA 2 concordaram • 🧮 conta conferida"
          : "✓ IA 1 e IA 2 concordaram"
      );

      update.disabled = false;
      update.textContent =
        "🔄 Atualizar";

      return;
    }

    result.textContent =
      "🤔 Consultando IA 3...";

    const ia3 =
      await solveWithRetry(
        MODELS[2],
        "IA 3",
        promptText
      );

    const valid = [];

    if (ia1.ok) valid.push(ia1);
    if (ia2.ok) valid.push(ia2);
    if (ia3.ok) valid.push(ia3);

    let winner = null;

    for (let i = 0; i < valid.length; i++) {
      for (
        let j = i + 1;
        j < valid.length;
        j++
      ) {
        if (
          valid[i].answer.key ===
          valid[j].answer.key
        ) {
          winner = [
            valid[i],
            valid[j]
          ];

          break;
        }
      }

      if (winner) break;
    }

    if (winner) {
      const mathOK =
        winner.some(
          item =>
            item.mathCheck === true
        );

      displayAnswer(
        winner[0].answer,
        mathOK
          ? "✓ Pelo menos 2 IAs concordaram • 🧮 conta conferida"
          : "✓ Pelo menos 2 IAs concordaram"
      );

    } else {
      const show = item => {
        if (!item.ok) return "falhou";

        return (
          (item.answer.choice
            ? item.answer.choice +
              " — "
            : "") +
          item.answer.answer
        );
      };

      result.textContent =
        "⚠️ RESPOSTA NÃO CONFIÁVEL" +
        "\n\nIA 1: " +
        show(ia1) +
        "\nIA 2: " +
        show(ia2) +
        "\nIA 3: " +
        show(ia3);

      status.textContent =
        "Não consegui obter duas respostas confiáveis iguais.";
    }

    update.disabled = false;

    update.textContent =
      "🔄 Atualizar";
  }

  update.onclick = solve;

  close.onclick = () => {
    box.remove();
    delete window.__KH5;
  };

  window.__KH5 = true;

  solve();
})();
