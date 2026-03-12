import { useState } from "react";
import { Check, Sparkles, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RepRow, Office } from "@shared/schema";

// ── Sub-components ────────────────────────────────────────────────────────────

function Counter({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold tabular-nums" style={{ color }}>
        {val.toLocaleString()}
      </span>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function RepRowItem({
  rep,
  active,
  expanded,
  onClick,
}: {
  rep: RepRow;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  const hasAddr = rep.offices && rep.offices.length > 0;
  const hasLetter = !!rep.letter;
  const hasBill = !!rep.billData;
  const filledCount = [hasAddr, hasLetter, hasBill].filter(Boolean).length;
  const isFed = rep.level === "Federal";

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-[#FAF9F7] ${
        active ? "bg-[#EDE9E3]" : ""
      }`}
      style={{ borderLeft: active ? "3px solid #1a1a1a" : "3px solid transparent" }}
      onClick={onClick}
    >
      <span className="flex-shrink-0">
        {filledCount === 3 ? (
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-[1.5px] border-[#D5D0C8] flex items-center justify-center">
            {filledCount > 0 && (
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: filledCount === 2 ? "#8B5CF6" : "#F59E0B" }}
              />
            )}
          </div>
        )}
      </span>
      <span className={`flex-1 text-[13px] truncate ${active ? "font-semibold" : "font-normal"}`}>
        {rep.name}
      </span>
      <span className="text-[11px] text-muted-foreground font-medium">{rep.state}</span>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded"
        style={{
          background: isFed ? "#DBEAFE" : "#F3F4F6",
          color: isFed ? "#3B82F6" : "#6B7280",
        }}
      >
        {isFed ? "FED" : "STA"}
      </span>
      {/* Expand chevron — mobile only */}
      <span className="md:hidden flex-shrink-0 text-muted-foreground ml-1">
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </span>
    </div>
  );
}

function SectionHead({
  color,
  bg,
  num,
  label,
}: {
  color: string;
  bg: string;
  num: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: bg }}>
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
        style={{ color, background: color + "18" }}
      >
        {num}
      </span>
      <span className="text-[12px] font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function DetailField({
  icon,
  label,
  val,
}: {
  icon: string;
  label: string;
  val: string;
}) {
  return (
    <div className="flex gap-2 py-1.5">
      <span className="text-muted-foreground text-sm flex-shrink-0 w-4 text-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
          {label}
        </span>
        <span className="text-[12px] text-gray-700 break-words leading-relaxed">{val}</span>
      </div>
    </div>
  );
}

function RepDetail({ rep }: { rep: RepRow }) {
  const offices = rep.offices || [];
  const dcOffices = offices.filter((o) => o.type === "dc");
  const districtOffices = offices.filter((o) => o.type !== "dc");

  function formatOfficeAddr(o: Office) {
    const parts = [o.address_line1];
    if (o.address_line2) parts.push(o.address_line2);
    parts.push(`${o.city}, ${o.state} ${o.zip}`);
    return parts.join(", ");
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="text-lg font-bold font-serif">{rep.name}</div>
      {rep.stance && (
        <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-200">
          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-0.5">
            On this issue
          </div>
          <div className="text-xs text-purple-800 leading-relaxed">{rep.stance}</div>
          {rep.relevance && (
            <div className="text-[11px] text-purple-500 italic mt-1">↳ {rep.relevance}</div>
          )}
          {rep.contactTip && (
            <div className="text-[11px] text-purple-500 mt-1">💡 {rep.contactTip}</div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px]">{rep.state}</Badge>
        <Badge variant="secondary" className="text-[10px]">{rep.chamber}</Badge>
        <Badge variant="secondary" className="text-[10px]">{rep.level}</Badge>
        {rep.district && <Badge variant="secondary" className="text-[10px]">{rep.district}</Badge>}
        {rep.party && (
          <Badge
            className="text-[10px]"
            style={{
              background: rep.party === "Democratic" ? "#DBEAFE" : rep.party === "Republican" ? "#FEE2E2" : "#F3F4F6",
              color: rep.party === "Democratic" ? "#2563EB" : rep.party === "Republican" ? "#DC2626" : "#6B7280",
            }}
          >
            {rep.party}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <SectionHead color="#3B82F6" bg="#EFF6FF" num={1} label="Contact" />
        <div className="pl-2 space-y-0.5">
          {rep.email && <DetailField icon="✉" label="Email" val={rep.email} />}
          {rep.phone && <DetailField icon="☎" label="Phone" val={rep.phone} />}
          {rep.website_url && <DetailField icon="⊕" label="Web" val={rep.website_url} />}
          {!rep.email && !rep.phone && !rep.website_url && offices.length === 0 && (
            <DetailField icon="·" label="Status" val="Contact info will be populated via AI" />
          )}
        </div>
      </div>

      {offices.length > 0 && (
        <div className="space-y-2">
          <SectionHead color="#F59E0B" bg="#FFFBEB" num={2} label={`Office Addresses (${offices.length})`} />
          <div className="pl-2 space-y-3">
            {dcOffices.map((o, i) => (
              <div key={`dc-${i}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">DC</span>
                  <span className="text-xs text-gray-600">{o.label}</span>
                </div>
                <DetailField icon="⌂" label="Address" val={formatOfficeAddr(o)} />
                {o.phone && <DetailField icon="☎" label="Phone" val={o.phone} />}
              </div>
            ))}
            {districtOffices.map((o, i) => (
              <div key={`dist-${i}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">District</span>
                  <span className="text-xs text-gray-600">{o.label}</span>
                </div>
                <DetailField icon="⌂" label="Address" val={formatOfficeAddr(o)} />
                {o.phone && <DetailField icon="☎" label="Phone" val={o.phone} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {rep.billData && (
        <div className="space-y-2">
          <SectionHead color="#EC4899" bg="#FDF2F8" num={3} label="Bill Reference" />
          <div className="pl-2 space-y-0.5">
            <DetailField icon="§" label="Bill" val={`${rep.billData.bill_id} — ${rep.billData.title}`} />
            {rep.billData.summary && <DetailField icon="·" label="Summary" val={rep.billData.summary} />}
            {rep.billData.url && <DetailField icon="⊕" label="Link" val={rep.billData.url} />}
          </div>
        </div>
      )}

      {rep.letter && (
        <div className="space-y-2">
          <SectionHead color="#10B981" bg="#ECFDF5" num={4} label="Letter Preview" />
          <div className="pl-2">
            <pre className="text-[12px] text-gray-600 font-mono leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-4 border border-gray-100">
              {rep.letter}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CTA bar (shared between mobile + desktop) ─────────────────────────────────

function ReadyCTA({
  withLetter,
  totalOfficeCount,
  withBills,
  onProceedToSend,
  className = "",
}: {
  withLetter: number;
  totalOfficeCount: number;
  withBills: number;
  onProceedToSend: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 px-6 py-3.5 bg-white border-t border-border flex items-center justify-between gap-4 animate-fadeIn flex-wrap ${className}`}
    >
      <div className="flex gap-4 flex-wrap">
        <span className="text-sm text-gray-500">
          <b className="text-emerald-500">{withLetter.toLocaleString()}</b> letters
        </span>
        <span className="text-sm text-gray-500">
          <b className="text-amber-500">{totalOfficeCount.toLocaleString()}</b> offices
        </span>
        {withBills > 0 && (
          <span className="text-sm text-gray-500">
            <b className="text-pink-500">{withBills.toLocaleString()}</b> bill-matched
          </span>
        )}
      </div>
      <Button
        onClick={onProceedToSend}
        className="font-semibold"
      >
        <Send className="w-4 h-4 mr-1.5" />
        Review & Edit
      </Button>
    </div>
  );
}

// ── Props interface ───────────────────────────────────────────────────────────

export interface CampaignLoaderProps {
  screen: "loading" | "ready";
  rows: RepRow[];
  selectedRow: RepRow | null;
  currentPhase: number;
  phaseProgress: Record<string, number>;
  phaseDone: Record<string, boolean>;
  logLines: { msg: string; color: string; ts: number }[];
  scrollRef: React.RefObject<HTMLDivElement>;
  logRef: React.RefObject<HTMLDivElement>;
  onSelectRow: (row: RepRow) => void;
  onProceedToSend: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaignLoader({
  screen,
  rows,
  selectedRow,
  logLines,
  scrollRef,
  logRef,
  onSelectRow,
  onProceedToSend,
}: CampaignLoaderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalOfficeCount = rows.reduce((sum, r) => sum + (r.offices?.length || 0), 0);
  const withLetter = rows.filter((r) => r.letter).length;
  const withBills = rows.filter((r) => r.billData).length;

  function handleRowClick(rep: RepRow) {
    onSelectRow(rep);
    setExpandedId((prev) => (prev === rep.id ? null : rep.id));
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const statsBar = (
    <div className="px-5 py-3.5 border-b border-border bg-white flex-shrink-0">
      <div className="grid grid-cols-4 gap-1 md:flex md:gap-6">
        <Counter label="Reps" val={rows.length} color="#3B82F6" />
        <Counter label="Offices" val={totalOfficeCount} color="#F59E0B" />
        <Counter label="Letters" val={withLetter} color="#10B981" />
        <Counter label="Bills" val={withBills} color="#EC4899" />
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

      {/* ── Left / main column: stats + rep list ── */}
      <div className="flex flex-col md:w-[46%] md:border-r border-border overflow-hidden bg-white min-h-0">
        {statsBar}

        {/* Rep list — scrollable on both layouts */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          {rows.map((rep) => (
            <div key={rep.id}>
              <RepRowItem
                rep={rep}
                active={selectedRow?.id === rep.id || expandedId === rep.id}
                expanded={expandedId === rep.id}
                onClick={() => handleRowClick(rep)}
              />
              {/* Mobile inline expansion */}
              {expandedId === rep.id && (
                <div className="md:hidden px-5 py-5 border-b border-border bg-[#FAFAF8]">
                  <RepDetail rep={rep} />
                </div>
              )}
            </div>
          ))}
        </ScrollArea>

        {/* Ready CTA — mobile only (sits below the list) */}
        {screen === "ready" && (
          <ReadyCTA
            withLetter={withLetter}
            totalOfficeCount={totalOfficeCount}
            withBills={withBills}
            onProceedToSend={onProceedToSend}
            className="md:hidden"
          />
        )}
      </div>

      {/* ── Right column: detail panel + log — desktop only ── */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden min-h-0 bg-background">
        <ScrollArea className="flex-1 p-6 border-b border-border">
          {selectedRow ? (
            <RepDetail rep={selectedRow} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
              <Sparkles className="w-8 h-8 text-[#D5D0C8]" />
              <span className="text-sm text-muted-foreground">
                Select a representative to inspect their record
              </span>
            </div>
          )}
        </ScrollArea>

        {/* Pipeline log — desktop only */}
        <div className="flex-shrink-0 h-[150px] flex flex-col bg-[#1E1E1E]">
          <div className="text-[11px] font-medium text-gray-400 px-4 py-2 border-b border-gray-700 font-mono">
            Pipeline Log
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2" ref={logRef}>
            {logLines.map((l, i) => (
              <div key={i} className="text-[11px] font-mono leading-[1.7]" style={{ color: l.color || "#9CA3AF" }}>
                {l.msg}
              </div>
            ))}
            {screen === "loading" && (
              <span className="text-emerald-500 animate-pulse inline">▌</span>
            )}
          </div>
        </div>

        {/* Ready CTA — desktop only */}
        {screen === "ready" && (
          <ReadyCTA
            withLetter={withLetter}
            totalOfficeCount={totalOfficeCount}
            withBills={withBills}
            onProceedToSend={onProceedToSend}
          />
        )}
      </div>
    </div>
  );
}
