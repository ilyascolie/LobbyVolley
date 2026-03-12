import { X, Loader2, Phone, Mail, Globe } from "lucide-react";
import type { EnrichedRep } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/api";

function RichRepCard({ rep, enriching }: { rep: EnrichedRep; enriching: boolean }) {
  const partyColor =
    rep.party === "Democratic" ? "#2563EB" : rep.party === "Republican" ? "#DC2626" : "#6B7280";
  const partyBg =
    rep.party === "Democratic" ? "#DBEAFE" : rep.party === "Republican" ? "#FEE2E2" : "#F3F4F6";
  const isFed = rep.level === "federal" || rep.level === "Federal";

  return (
    <div className="bg-white border border-border rounded-[14px] p-4 flex flex-col gap-2.5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex gap-3 items-start">
        <div className="flex-shrink-0 relative">
          {rep.photoUrl ? (
            <img
              src={rep.photoUrl}
              alt={rep.name}
              className="w-[50px] h-[50px] rounded-full object-cover border-2 border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                if (next) next.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-[50px] h-[50px] rounded-full bg-gray-100 items-center justify-center text-base font-bold text-gray-400 border-2 border-border"
            style={{ display: rep.photoUrl ? "none" : "flex" }}
          >
            {getInitials(rep.name)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight mb-0.5">{rep.name}</div>
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">
            {rep.chamber || ""}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold"
              style={{
                background: isFed ? "#DBEAFE" : "#F3F4F6",
                color: isFed ? "#3B82F6" : "#6B7280",
              }}
            >
              {isFed ? "Federal" : "State"}
            </Badge>
            {rep.party && (
              <Badge
                variant="secondary"
                className="text-[10px] font-semibold"
                style={{ background: partyBg, color: partyColor }}
              >
                {rep.party}
              </Badge>
            )}
            {rep.district && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {rep.district}
              </Badge>
            )}
            {rep.state && (
              <Badge variant="secondary" className="text-[10px]">
                {rep.state}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {enriching && !rep.bio && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
          <span className="text-[11px] text-muted-foreground italic">
            Fetching profile…
          </span>
        </div>
      )}

      {/* Bio */}
      {rep.bio && (
        <p className="text-xs text-gray-500 leading-relaxed border-l-2 border-border pl-3 m-0">
          {rep.bio}
        </p>
      )}

      {/* Details */}
      {rep.committee && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            Key Committee
          </div>
          <div className="text-xs text-gray-700 leading-snug">{rep.committee}</div>
        </div>
      )}

      {/* Challenger */}
      {rep.challenger && (
        <div className="flex items-center gap-1.5 p-2 bg-red-50 rounded-lg border border-red-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            Challenger
          </span>
          <span className="text-xs font-semibold text-red-600">{rep.challenger}</span>
          {rep.challengerParty && (
            <span className="text-[11px] text-red-400">({rep.challengerParty})</span>
          )}
        </div>
      )}

      {/* Contact links */}
      {(rep.phone || rep.email || rep.contactUrl) && (
        <div className="flex flex-wrap gap-1.5">
          {rep.phone && (
            <a
              href={`tel:${rep.phone}`}
              className="text-[11px] text-blue-500 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 no-underline font-medium flex items-center gap-1 hover:bg-blue-100 transition-colors"
            >
              <Phone className="w-3 h-3" />
              {rep.phone}
            </a>
          )}
          {rep.email && (
            <a
              href={`mailto:${rep.email}`}
              className="text-[11px] text-blue-500 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 no-underline font-medium flex items-center gap-1 hover:bg-blue-100 transition-colors"
            >
              <Mail className="w-3 h-3" />
              {rep.email}
            </a>
          )}
          {rep.contactUrl && (
            <a
              href={rep.contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-500 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 no-underline font-medium flex items-center gap-1 hover:bg-blue-100 transition-colors"
            >
              <Globe className="w-3 h-3" />
              Contact page
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function RepFinderPanel({
  reps,
  enriching,
  visible,
  onClose,
}: {
  reps: EnrichedRep[];
  enriching: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {visible && (
        <div
          className="fixed top-0 right-0 w-[430px] h-screen bg-background border-l border-border flex flex-col z-[300] shadow-2xl animate-slideInRight"
        >
          <div className="flex items-start justify-between px-5 py-4 bg-white border-b border-border flex-shrink-0">
            <div>
              <div className="text-sm font-bold font-serif mb-0.5">Representative Profiles</div>
              <div className="text-[11px] text-muted-foreground">
                {enriching ? (
                  <span className="text-emerald-500">⟳ Enriching with AI…</span>
                ) : reps.length > 0 ? (
                  `${reps.length} found · includes bios, committees & contact info`
                ) : (
                  "No reps loaded yet"
                )}
              </div>
            </div>
            <button
              className="text-2xl text-muted-foreground hover:text-foreground transition-colors leading-none mt-[-2px]"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <ScrollArea className="flex-1 p-3.5">
            <div className="space-y-3">
              {reps.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No representatives to display.
                </div>
              ) : (
                reps.map((rep, i) => (
                  <RichRepCard key={`${rep.name}-${i}`} rep={rep} enriching={enriching} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
}
