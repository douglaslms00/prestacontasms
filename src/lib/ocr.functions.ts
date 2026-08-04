import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  dataUrl: z.string().min(20),
  mimeType: z.string().min(3),
  fileName: z.string().max(200).optional(),
});

export type ReceiptOcr = {
  merchant: string | null;
  date: string | null;
  amount: number | null;
  category: string | null;
};

const SYSTEM = `Você lê cupons fiscais e notas brasileiras. Responda SOMENTE com JSON válido no formato:
{"merchant": string|null, "date": "YYYY-MM-DD"|null, "amount": number|null, "category": string|null}
- merchant: nome do estabelecimento.
- date: data da compra (converta DD/MM/AAAA para AAAA-MM-DD).
- amount: valor TOTAL pago, como número com ponto decimal (ex: 123.45). Nunca use separador de milhar.
- category: uma de Alimentação, Transporte, Hospedagem, Combustível, Material, Outros.
Se não conseguir ler algum campo, use null.`;

function parseJson(text: string): ReceiptOcr {
  const match = text.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : text;
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    obj = {};
  }
  const amountRaw = obj["amount"];
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number(amountRaw.replace(/\./g, "").replace(",", "."))
        : null;
  const dateRaw = typeof obj["date"] === "string" ? (obj["date"] as string) : null;
  return {
    merchant: typeof obj["merchant"] === "string" ? (obj["merchant"] as string) : null,
    date: dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null,
    amount: typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : null,
    category: typeof obj["category"] === "string" ? (obj["category"] as string) : null,
  };
}

export const readReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ReceiptOcr> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("IA indisponível no momento");

    const content = data.mimeType.startsWith("image/")
      ? [
          { type: "text", text: "Extraia os dados deste cupom fiscal." },
          { type: "image_url", image_url: { url: data.dataUrl } },
        ]
      : [
          { type: "text", text: "Extraia os dados deste cupom fiscal." },
          {
            type: "file",
            file: { filename: data.fileName ?? "cupom.pdf", file_data: data.dataUrl },
          },
        ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("Muitas leituras seguidas. Tente novamente em instantes.");
      if (response.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na leitura do cupom [${response.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return parseJson(json.choices?.[0]?.message?.content ?? "");
  });
