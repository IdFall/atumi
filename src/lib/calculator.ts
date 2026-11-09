/**
 * Calculatrice scientifique de la boîte à outils : analyse d'une expression
 * saisie par l'élève, sans `eval`. Opérations + − × ÷ ^ %, parenthèses, !,
 * fonctions (sin, cos, tan, asin, acos, atan, sqrt/√, ln, log, abs, exp),
 * constantes π et e, virgule ou point décimal, multiplication implicite (2π, 3(4+1)).
 */

export type AngleUnit = "deg" | "rad";

export type CalcResult = { ok: true; value: number } | { ok: false; error: "syntax" | "domain" };

type Token = { kind: "num"; value: number } | { kind: "id"; name: string } | { kind: "op"; op: string };

const FUNCTIONS = ["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "ln", "log", "abs", "exp"] as const;
type FunctionName = (typeof FUNCTIONS)[number];

class CalcError extends Error {
  constructor(readonly kind: "syntax" | "domain") {
    super(kind);
  }
}

function tokenize(input: string): Token[] {
  const src = input
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/√/g, " sqrt ")
    .replace(/π/g, " pi ")
    .toLowerCase();
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.,]/.test(src[j])) j++;
      // Exposant : 1,5e3 ou 2e-4.
      if (src[j] === "e" && /[0-9+-]/.test(src[j + 1] ?? "") && (/[0-9]/.test(src[j + 1]) || /[0-9]/.test(src[j + 2] ?? ""))) {
        j += 2;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const text = src.slice(i, j).replace(",", ".");
      if ((text.match(/\./g) ?? []).length > 1 || text === ".") throw new CalcError("syntax");
      tokens.push({ kind: "num", value: Number(text) });
      i = j;
    } else if (/[a-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      tokens.push({ kind: "id", name: src.slice(i, j) });
      i = j;
    } else if ("+-*/^%!()".includes(c)) {
      tokens.push({ kind: "op", op: c });
      i++;
    } else {
      throw new CalcError("syntax");
    }
  }
  return tokens;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new CalcError("domain");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

/** Arrondit les erreurs de virgule flottante (0,1 + 0,2 = 0,3 ; sin 180° = 0). */
function tidy(x: number): number {
  if (!Number.isFinite(x)) throw new CalcError("domain");
  const rounded = Number(x.toPrecision(12));
  return Math.abs(rounded) < 1e-12 ? 0 : rounded;
}

export function calculate(input: string, angle: AngleUnit = "deg"): CalcResult {
  let tokens: Token[];
  try {
    tokens = tokenize(input);
  } catch {
    return { ok: false, error: "syntax" };
  }
  if (tokens.length === 0) return { ok: false, error: "syntax" };
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (op: string) => {
    const t = peek();
    return t?.kind === "op" && t.op === op;
  };
  const toRad = (x: number) => (angle === "deg" ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angle === "deg" ? (x * 180) / Math.PI : x);

  function apply(name: FunctionName, x: number): number {
    switch (name) {
      case "sin":
        return Math.sin(toRad(x));
      case "cos":
        return Math.cos(toRad(x));
      case "tan": {
        const c = Math.cos(toRad(x));
        if (Math.abs(c) < 1e-12) throw new CalcError("domain");
        return Math.sin(toRad(x)) / c;
      }
      case "asin":
      case "acos":
        if (x < -1 || x > 1) throw new CalcError("domain");
        return fromRad(name === "asin" ? Math.asin(x) : Math.acos(x));
      case "atan":
        return fromRad(Math.atan(x));
      case "sqrt":
        if (x < 0) throw new CalcError("domain");
        return Math.sqrt(x);
      case "ln":
      case "log":
        if (x <= 0) throw new CalcError("domain");
        return name === "ln" ? Math.log(x) : Math.log10(x);
      case "abs":
        return Math.abs(x);
      case "exp":
        return Math.exp(x);
    }
  }

  // expression := terme (('+' | '-') terme)*
  function expression(): number {
    let value = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { op: string }).op;
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  // terme := unaire (('*' | '/') unaire | unaire implicite)*
  function term(): number {
    let value = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (tokens[pos++] as { op: string }).op;
        const right = unary();
        if (op === "/" && right === 0) throw new CalcError("domain");
        value = op === "*" ? value * right : value / right;
      } else if (peek() && (peek().kind === "num" || peek().kind === "id" || isOp("("))) {
        value *= unary();
      } else {
        return value;
      }
    }
  }

  // unaire := ('-' | '+') unaire | puissance
  function unary(): number {
    if (isOp("-")) {
      pos++;
      return -unary();
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }

  // puissance := postfixe ('^' unaire)?   (associative à droite : 2^3^2 = 2^9)
  function power(): number {
    const base = postfix();
    if (isOp("^")) {
      pos++;
      return Math.pow(base, unary());
    }
    return base;
  }

  // postfixe := primaire ('!' | '%')*
  function postfix(): number {
    let value = primary();
    for (;;) {
      if (isOp("!")) {
        pos++;
        value = factorial(value);
      } else if (isOp("%")) {
        pos++;
        value /= 100;
      } else {
        return value;
      }
    }
  }

  function primary(): number {
    const t = tokens[pos++];
    if (!t) throw new CalcError("syntax");
    if (t.kind === "num") return t.value;
    if (t.kind === "op" && t.op === "(") {
      const value = expression();
      if (!isOp(")")) throw new CalcError("syntax");
      pos++;
      return value;
    }
    if (t.kind === "id") {
      if (t.name === "pi") return Math.PI;
      if (t.name === "e") return Math.E;
      if ((FUNCTIONS as readonly string[]).includes(t.name)) return apply(t.name as FunctionName, unary());
    }
    throw new CalcError("syntax");
  }

  try {
    const value = expression();
    if (pos !== tokens.length) return { ok: false, error: "syntax" };
    return { ok: true, value: tidy(value) };
  } catch (error) {
    return { ok: false, error: error instanceof CalcError ? error.kind : "syntax" };
  }
}
