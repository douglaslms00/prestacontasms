import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR, statusLabel } from "@/lib/format";

export type ReportExpense = {
  description: string;
  category: string;
  amount: number;
  spent_at: string;
  receipt_path: string | null;
};

export type ReportAdvance = {
  title: string;
  description?: string | null;
  amount: number;
  issued_at: string;
  status: string;
  decision?: string | null;
  review_comment?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
};

async function loadImage(path: string) {
  const { data, error } = await supabase.storage.from("cupons").download(path);
  if (error || !data) return null;
  if (!data.type.startsWith("image/")) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(data);
  });
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
  if (!img) return null;
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
}

export type ReportTopup = { amount: number; note: string | null; issued_at: string };

export async function generateReport(
  advance: ReportAdvance,
  expenses: ReportExpense[],
  employeeName: string,
  topups: ReportTopup[] = [],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const gasto = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalTopups = topups.reduce((s, t) => s + Number(t.amount), 0);
  const liberado = Number(advance.amount) + totalTopups;
  const saldo = liberado - gasto;

  doc.setFontSize(18);
  doc.text("Prestação de Contas", margin, 56);
  doc.setFontSize(12);
  doc.text(advance.title, margin, 78);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `Funcionário: ${employeeName}  ·  Liberado em ${dateBR(advance.issued_at)}  ·  Situação: ${
      statusLabel[advance.status] ?? advance.status
    }${advance.decision ? ` (${advance.decision})` : ""}`,
    margin,
    96,
  );
  if (advance.description) {
    doc.text(doc.splitTextToSize(advance.description, pageW - margin * 2), margin, 112);
  }
  doc.setTextColor(0);

  autoTable(doc, {
    startY: advance.description ? 136 : 120,
    head: [["Resumo", "Valor"]],
    body: [
      ["Valor inicial liberado", brl(Number(advance.amount))],
      ["Verbas adicionais", brl(totalTopups)],
      ["Total disponibilizado", brl(liberado)],
      ["Total de despesas", brl(gasto)],
      ["Saldo restante", brl(Math.max(saldo, 0))],
      [saldo >= 0 ? "Valor a devolver" : "Valor a reembolsar", brl(Math.abs(saldo))],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 82, 72] },
    margin: { left: margin, right: margin },
  });

  if (topups.length > 0) {
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
      head: [["Data", "Verba adicional", "Valor"]],
      body: topups.map((t) => [dateBR(t.issued_at), t.note ?? "—", brl(Number(t.amount))]),
      theme: "grid",
      headStyles: { fillColor: [16, 82, 72] },
      margin: { left: margin, right: margin },
    });
  }

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
    head: [["Data", "Descrição", "Categoria", "Cupom", "Valor"]],
    body: expenses.map((e) => [
      dateBR(e.spent_at),
      e.description,
      e.category,
      e.receipt_path ? "Anexado" : "—",
      brl(Number(e.amount)),
    ]),
    theme: "striped",
    headStyles: { fillColor: [16, 82, 72] },
    margin: { left: margin, right: margin },
  });

  if (advance.review_comment) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
    doc.setFontSize(10);
    doc.text("Parecer do gestor:", margin, y);
    doc.text(doc.splitTextToSize(advance.review_comment, pageW - margin * 2), margin, y + 14);
  }

  const withReceipts = expenses.filter((e) => e.receipt_path);
  for (const e of withReceipts) {
    const img = await loadImage(e.receipt_path!);
    doc.addPage();
    doc.setFontSize(12);
    doc.text(`Cupom: ${e.description}`, margin, 56);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${dateBR(e.spent_at)} · ${e.category} · ${brl(Number(e.amount))}`, margin, 72);
    doc.setTextColor(0);
    if (img) {
      const maxW = pageW - margin * 2;
      const maxH = pageH - 120;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      doc.addImage(img.dataUrl, margin, 92, img.width * ratio, img.height * ratio);
    } else {
      doc.setFontSize(10);
      doc.text(
        "Anexo em PDF — disponível para download no histórico de despesas do sistema.",
        margin,
        100,
      );
    }
  }

  doc.save(`prestacao-${advance.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
