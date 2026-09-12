import { OBRAS_APP_URL } from "@/lib/obras";

export function baseUrl() {
  // A URL configurada aponta para a tela de login (/auth); para as chamadas de
  // API usamos apenas a origem (ex.: https://msgestaopro.lovable.app).
  const raw = process.env["OBRAS_API_URL"] ?? OBRAS_APP_URL;
  return raw.replace(/\/auth\/?$/, "").replace(/\/$/, "");
}

export function apiKey() {
  const key = process.env["OBRAS_API_KEY"];
  if (!key) {
    throw new Error(
      "Integração indisponível: a chave de acesso do sistema de obras não está configurada.",
    );
  }
  return key;
}

export function friendlyError(status: number, body: string) {
  if (status === 404) {
    return "Integração indisponível: o sistema de obras ainda não publicou os endpoints /api/public/obras e /api/public/prestacoes.";
  }
  if (status === 401 || status === 403) {
    return "Integração recusada: a chave de acesso do sistema de obras é inválida.";
  }
  return `Falha na integração [${status}]: ${body.slice(0, 200)}`;
}

export type ObraExterna = {
  id?: string | number;
  codigo?: string;
  nome?: string;
  cliente?: string | null;
  status?: string;
};

export function normalizeObras(payload: unknown) {
  const list: ObraExterna[] = Array.isArray(payload)
    ? (payload as ObraExterna[])
    : Array.isArray((payload as { obras?: unknown })?.obras)
      ? (payload as { obras: ObraExterna[] }).obras
      : [];

  return list
    .filter((o) => o && (o.id !== undefined || o.codigo))
    .map((o) => ({
      external_id: String(o.id ?? o.codigo),
      codigo: String(o.codigo ?? ""),
      nome: String(o.nome ?? o.codigo ?? "Obra"),
      cliente: o.cliente ?? null,
      status: String(o.status ?? "ativa"),
    }));
}
