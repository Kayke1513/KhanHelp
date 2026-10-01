(() => {
  if (window.__KH4 && document.getElementById("kh4")) return;

  const apiKey = prompt("Cole sua chave da API Groq:");
  if (!apiKey) return;

  const MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b"
  ];

  // =========================
  // JANELA
  // =========================

  const box = document.createElement("div");
  box.id = "kh4";

  box.style.cssText = `
    position: fixed;
    right: 8px;
    top: 8px;
    width: min(290px, calc(100vw - 16px));
    z-index: 2147483647;
    background: #fff;
    color: #111;
    border: 2px solid #1865f2;
    border-radius: 12px;
    padding: 10px;
    font: 13px Arial;
    box-shadow: 0 4px 18px #0006;
    max-height: 45vh;
    overflow: auto;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    touch-action: none;
    user-select: none;
    cursor: move;
    padding: 4px 2px;
  `;

  header.innerHTML = "<b>📘 Khan Helper</b>";

  const close = document.createElement("button");
  close.textContent = "✕";

  close.style.cssText = `
    float: right;
    border: 0;
    background: #eee;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 15px;
  `;

  header.appendChild(close);

  const result = document.createElement("div");
  result.style.cssText = `
    margin: 9px 0;
    white-space: pre-wrap;
    line-height: 1.4;
  `;

  const status = document.createElement("div");
  status.style.cssText = `
    font-size: 10px;
    color: #777;
    margin-bottom: 6px;
  `;

  const update = document.createElement("button");
  update.textContent = "🔄 Atualizar";

  update.style.cssText = `
    width: 100%;
    padding: 9px;
    border: 0;
    border-radius: 8px;
    background: #1865f2;
    color: #fff;
    font-weight: bold;
    font-size: 14px;
  `;

  box.append(header, result, status, update);
  document.body.appendChild(box);

  // =========================
  // ARRASTAR JANELA
  // =========================

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;

  header.onpointerdown = e => {
    if (e.target === close) return;

    dragging = true;

    const rect = box.getBoundingClientRect();

    startX = e.clientX;
    startY = e.clientY;
    baseX = rect.left;
    baseY = rect.top;

    box.style.left = baseX + "px";
    box.style.top = baseY + "px";
    box.style.right = "auto";
    box.style.bottom = "auto";

    header.setPointerCapture?.(e.pointerId);
  };

  header.onpointermove = e => {
    if (!dragging) return;

    let x = baseX + e.clientX - startX;
    let y = baseY + e.clientY - startY;

    x = Math.max(
      4,
      Math.min(x, innerWidth - box.offsetWidth - 4)
    );

    y = Math.max(
      4,
      Math.min(y, innerHeight - box.offsetHeight - 4)
    );

    box.style.left = x + "px";
    box.style.top = y + "px";
  };

  header.onpointerup =
  header.onpointercancel = () => {
    dragging = false;
  };

  // =========================
  // PEGAR QUESTÃO
  // =========================

  function getQuestion() {
    const root =
      document.querySelector(
        '[data-testid="content-library-content-panel"]'
      ) ||
      document.querySelector('main,[role="main"]') ||
      document.body;

    let text = root.innerText || "";

    root
      .querySelectorAll(
        "[aria-label],[alt],[title],svg text,svg tspan,svg title,svg desc"
      )
      .forEach(el => {
        if (el.closest?.("#kh4")) return;

        const value =
          el.getAttribute?.("aria-label") ||
          el.getAttribute?.("alt") ||
          el.getAttribute?.("title") ||
          el.textContent ||
          "";

        text += "\n" + value;
      });

    return text.slice(0, 12000);
  }

  // =========================
  // API GROQ
  // =========================

  async function callAI(model, promptText) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      30000
    );

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
            max_completion_tokens: 1400
          }),

          signal: controller.signal
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

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

      const jsonMatch =
        content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("JSON inválido");
      }

      return JSON.parse(jsonMatch[0]);
    } finally {
      clearTimeout(timer);
    }
  }

  // =========================
  // NORMALIZAR RESPOSTA
  // =========================

  function normalize(obj) {
    const choice = String(
      obj.choice || ""
    )
      .trim()
      .toUpperCase();

    const answer = String(
      obj.answer || ""
    ).trim();

    const explanation = String(
      obj.explanation || ""
    ).trim();

    const calc = String(
      obj.calc || ""
    ).trim();

    let key;

    if (/^[A-F]$/.test(choice)) {
      key = "LETTER:" + choice;
    } else {
      key =
        "ANSWER:" +
        answer
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "")
          .replace(",", ".")
          .replace(/[^a-z0-9.+\-√]/g, "");
    }

    return {
      choice,
      answer,
      explanation,
      calc,
      key
    };
  }

  // =========================
  // CALCULADORA INTERNA
  // =========================

  function calculate(expression) {
    if (!expression) return null;

    let e = expression
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/π/g, "pi")
      .replace(/√\s*\(/g, "sqrt(")
      .replace(/\^/g, "**");

    if (
      !/^[0-9+\-*/().\s_a-z*]+$/.test(e)
    ) {
      return null;
    }

    const allowedNames = [
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

    for (const name of allowedNames) {
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

    const SIN = n =>
      Math.sin(n * Math.PI / 180);

    const COS = n =>
      Math.cos(n * Math.PI / 180);

    const TAN = n =>
      Math.tan(n * Math.PI / 180);

    const ASIN = n =>
      Math.asin(n) * 180 / Math.PI;

    const ACOS = n =>
      Math.acos(n) * 180 / Math.PI;

    const ATAN = n =>
      Math.atan(n) * 180 / Math.PI;

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

  function getNumber(text) {
    const match = String(text || "")
      .replace(",", ".")
      .match(/-?\d+(?:\.\d+)?/);

    return match
      ? Number(match[0])
      : null;
  }

  // true = conta bate
  // false = conta não bate
  // null = não conseguiu conferir

  function verifyMath(obj) {
    const calculated =
      calculate(obj.calc);

    const answerNumber =
      getNumber(obj.answer);

    if (
      calculated == null ||
      answerNumber == null
    ) {
      return null;
    }

    const tolerance = Math.max(
      0.05,
      Math.abs(answerNumber) * 0.015
    );

    return (
      Math.abs(
        calculated - answerNumber
      ) <= tolerance
    );
  }

  // =========================
  // TENTAR IA ATÉ 2 VEZES
  // =========================

  async function solveWithRetry(
    model,
    name,
    promptText
  ) {
    let lastError = "";

    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      try {
        status.textContent =
          name +
          " — tentativa " +
          attempt +
          "/2...";

        const raw = await callAI(
          model,
          promptText
        );

        const response =
          normalize(raw);

        if (!response.answer) {
          throw new Error(
            "sem resposta final"
          );
        }

        const mathCheck =
          verifyMath(response);

        // Se a própria conta contradiz
        // a resposta, descarta e tenta de novo.
        if (mathCheck === false) {
          lastError =
            "a conta não bateu";

          continue;
        }

        return {
          ok: true,
          response,
          mathCheck
        };

      } catch (error) {
        lastError =
          error?.message ||
          "erro desconhecido";
      }
    }

    return {
      ok: false,
      error: lastError
    };
  }

  // =========================
  // PROMPT
  // =========================

  function buildPrompt(question) {
    return `
Resolva SOMENTE a questão escolar abaixo.

Faça a resolução do zero.

Confira todos os números e cálculos antes de responder.

Não chute.

Se for múltipla escolha:
- choice deve ser apenas a letra correta.
- answer deve conter a resposta correspondente.

Se houver um resultado numérico, forneça também uma expressão em calc que reproduza o resultado final.

Na propriedade calc use somente:
números,
+ - * / ^,
parênteses,
sqrt,
sin,
cos,
tan,
asin,
acos,
atan.

Trigonometria deve usar graus.

Não use LaTeX.

Responda SOMENTE JSON válido neste formato:

{
  "choice": "A ou vazio",
  "answer": "resposta final",
  "explanation": "explicação muito simples em até 2 frases",
  "calc": "expressão matemática ou vazio"
}

QUESTÃO:

${question}
`;
  }

  // =========================
  // MOSTRAR RESPOSTA
  // =========================

  function showConfirmed(
    obj,
    message
  ) {
    const prefix = obj.choice
      ? obj.choice + " — "
      : "";

    result.textContent =
      "✅ RESPOSTA CONFIRMADA: " +
      prefix +
      obj.answer +
      "\n\nEXPLICAÇÃO: " +
      obj.explanation;

    status.textContent = message;
  }

  // =========================
  // RESOLVER
  // =========================

  async function solve() {
    update.disabled = true;

    update.textContent =
      "⏳ Analisando...";

    result.textContent =
      "🤔 IA 1 e IA 2 estão resolvendo...";

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

    // IA 1
    const ia1 =
      await solveWithRetry(
        MODELS[0],
        "IA 1",
        promptText
      );

    // IA 2
    const ia2 =
      await solveWithRetry(
        MODELS[1],
        "IA 2",
        promptText
      );

    const valid = [];

    if (ia1.ok) {
      valid.push({
        name: "IA 1",
        ...ia1
      });
    }

    if (ia2.ok) {
      valid.push({
        name: "IA 2",
        ...ia2
      });
    }

    // =========================
    // IA 1 + IA 2 concordaram
    // =========================

    if (
      ia1.ok &&
      ia2.ok &&
      ia1.response.key ===
        ia2.response.key
    ) {
      const mathVerified =
        ia1.mathCheck === true ||
        ia2.mathCheck === true;

      showConfirmed(
        ia1.response,
        mathVerified
          ? "✓ IA 1 e IA 2 concordaram • 🧮 conta conferida"
          : "✓ IA 1 e IA 2 concordaram"
      );

      update.disabled = false;
      update.textContent =
        "🔄 Atualizar";

      return;
    }

    // =========================
    // CHAMAR IA 3
    // =========================

    result.textContent =
      "🤔 Verificando com IA 3...";

    status.textContent =
      "IA 1 e IA 2 não confirmaram a mesma resposta.";

    const ia3 =
      await solveWithRetry(
        MODELS[2],
        "IA 3",
        promptText
      );

    if (ia3.ok) {
      valid.push({
        name: "IA 3",
        ...ia3
      });
    }

    // =========================
    // PROCURAR 2 RESPOSTAS IGUAIS
    // =========================

    let winner = null;

    for (
      let i = 0;
      i < valid.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < valid.length;
        j++
      ) {
        if (
          valid[i].response.key ===
          valid[j].response.key
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
      const obj =
        winner[0].response;

      const mathVerified =
        winner.some(
          item =>
            item.mathCheck === true
        );

      showConfirmed(
        obj,
        mathVerified
          ? "✓ Pelo menos 2 IAs concordaram • 🧮 conta conferida"
          : "✓ Pelo menos 2 IAs concordaram"
      );

    } else {
      const text1 = ia1.ok
        ? (
            ia1.response.choice
              ? ia1.response.choice +
                " — "
              : ""
          ) +
          ia1.response.answer
        : "falhou";

      const text2 = ia2.ok
        ? (
            ia2.response.choice
              ? ia2.response.choice +
                " — "
              : ""
          ) +
          ia2.response.answer
        : "falhou";

      const text3 = ia3.ok
        ? (
            ia3.response.choice
              ? ia3.response.choice +
                " — "
              : ""
          ) +
          ia3.response.answer
        : "falhou";

      result.textContent =
        "⚠️ RESPOSTA NÃO CONFIÁVEL" +
        "\n\nIA 1: " +
        text1 +
        "\nIA 2: " +
        text2 +
        "\nIA 3: " +
        text3;

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
    delete window.__KH4;
  };

  window.__KH4 = true;

  solve();
})();
