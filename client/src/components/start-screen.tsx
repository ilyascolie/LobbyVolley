import {
  Search,
  MapPin,
  ArrowLeft,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import RepFinderPanel from "@/components/rep-panel";
import type { SonarLookupResult, BillResult, EnrichedRep } from "@shared/schema";

// ── FormState ─────────────────────────────────────────────────────────────────

export interface FormState {
  cause: string;
  senderFullName: string;
  returnAddress: string;
  senderRole: string;
  senderExperience: string;
  impactOutcome: string;
  impactStakeholder: string;
  impactReason: string;
  impactDifference: string;
  impactResearch: string;
  autoResearch: boolean;
  manualBillText: string;
}

// ── Props interface ───────────────────────────────────────────────────────────

export interface StartScreenProps {
  form: FormState;
  updateForm: (updates: Partial<FormState>) => void;
  zipCodes: string[];
  validZips: string[];
  sonarResults: SonarLookupResult | null;
  sonarLoading: boolean;
  sonarError: string | null;
  richReps: EnrichedRep[];
  repPanelVisible: boolean;
  enrichingReps: boolean;
  previewBills: BillResult[];
  billsLoading: boolean;
  canStart: boolean;
  onAddZip: () => void;
  onUpdateZip: (idx: number, val: string) => void;
  onRemoveZip: (idx: number) => void;
  onLookupReps: () => void;
  onAutoResearchToggle: (on: boolean) => void;
  onStart: () => void;
  onBack: () => void;
  onSetRepPanelVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
}

// ── FormBlock helper ──────────────────────────────────────────────────────────

function FormBlock({
  num,
  numBg,
  numColor,
  title,
  badge,
  badgeBg = "#F3F4F6",
  badgeColor = "#9CA3AF",
  headerRight,
  children,
}: {
  num: string;
  numBg: string;
  numColor: string;
  title: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 rounded-xl border border-border overflow-hidden bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-[#FAFAF8]">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: numBg, color: numColor }}
        >
          {num}
        </span>
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded"
            style={{ background: badgeBg, color: badgeColor }}
          >
            {badge}
          </span>
        )}
        {headerRight}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StartScreen({
  form,
  updateForm,
  zipCodes,
  validZips,
  sonarResults,
  sonarLoading,
  sonarError,
  richReps,
  repPanelVisible,
  enrichingReps,
  previewBills,
  billsLoading,
  canStart,
  onAddZip,
  onUpdateZip,
  onRemoveZip,
  onLookupReps,
  onAutoResearchToggle,
  onStart,
  onBack,
  onSetRepPanelVisible,
}: StartScreenProps) {
  return (
    <>
      <div
        className="flex-1 flex items-start justify-center py-10 overflow-y-auto animate-fadeIn transition-[padding] duration-300"
        style={{ paddingLeft: 40, paddingRight: repPanelVisible ? 460 : 40 }}
      >
        <div className="w-full max-w-[620px]">
          <button
            className="text-muted-foreground text-sm font-medium mb-4 flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <h2 className="font-serif text-3xl tracking-tight mb-2">
            Build your letter with persuasive details
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-7">
            Find your representatives by ZIP, then compose your letter.
            <br />
            AI generates a unique, personalized letter draft for each representative. Just edit or approve.
          </p>

          {/* ── ZIP Lookup ── */}
          <div className="mb-7 py-5 border-y border-border">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Find your representatives
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: "#B91C1C" }}>Required</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {zipCodes.map((zip, i) => (
                <div key={i} className="flex items-center gap-0.5">
                  <Input
                    type="text"
                    className="w-[72px] text-center font-mono text-sm tracking-widest"
                    placeholder="ZIP"
                    value={zip}
                    onChange={(e) => onUpdateZip(i, e.target.value)}
                    maxLength={5}
                  />
                  {zipCodes.length > 1 && (
                    <button
                      className="w-5 h-5 flex items-center justify-center text-red-500 hover:text-red-700 rounded"
                      onClick={() => onRemoveZip(i)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                className="w-9 h-9 flex items-center justify-center border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-gray-400 transition-colors"
                onClick={onAddZip}
              >
                <Plus className="w-4 h-4" />
              </button>
              <Button
                onClick={onLookupReps}
                disabled={validZips.length === 0 || sonarLoading}
                className="ml-1"
              >
                {sonarLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1" />
                    Find My Reps
                  </>
                )}
              </Button>
            </div>

            {sonarError && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-600 leading-relaxed">
                {sonarError}
              </div>
            )}

            {sonarResults && sonarResults.representatives.length > 0 && (
              <div
                className="mt-3.5 flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-300 animate-fadeIn"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-green-600">
                    {sonarResults.representatives.length} representatives found
                  </span>
                  {sonarResults.location && (
                    <span className="text-xs text-green-400">· ZIP {sonarResults.location}</span>
                  )}
                  {enrichingReps && (
                    <span className="text-[11px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      Loading profiles
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold"
                  onClick={() => onSetRepPanelVisible((v) => !v)}
                >
                  {repPanelVisible ? "Hide profiles" : "View profiles →"}
                </Button>
              </div>
            )}

            {sonarResults && sonarResults.representatives.length === 0 && !sonarError && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-600">
                No representatives found. Try a different ZIP code.
              </div>
            )}
          </div>

          {/* ── Your Name ── */}
          <FormBlock
            num="⊙"
            numBg="#F0FDF4"
            numColor="#16A34A"
            title="Your Name"
            badge="Required"
            badgeBg="#FEE2E2"
            badgeColor="#DC2626"
          >
            <p className="text-xs text-muted-foreground italic mb-3 leading-relaxed">
              Used as the sender name on all letters — your real name avoids legal issues.
            </p>
            <Input
              placeholder="e.g. Jane Doe"
              value={form.senderFullName}
              onChange={(e) => updateForm({ senderFullName: e.target.value })}
            />
          </FormBlock>

          {/* ── Return Address ── */}
          <FormBlock
            num="✉"
            numBg="#F5F3FF"
            numColor="#7C3AED"
            title="Return Address"
            badge="Optional"
            badgeBg="#F3F4F6"
            badgeColor="#6B7280"
          >
            <p className="text-xs text-muted-foreground italic mb-3 leading-relaxed">
              Required to receive a response from your representative's office.
            </p>
            <Input
              placeholder="Your full mailing address"
              value={form.returnAddress}
              onChange={(e) => updateForm({ returnAddress: e.target.value })}
            />
          </FormBlock>

          {/* ── Campaign Subject ── */}
          <FormBlock
            num="1"
            numBg="#DBEAFE"
            numColor="#3B82F6"
            title="Campaign Subject"
            badge="Required"
            badgeBg="#FEE2E2"
            badgeColor="#DC2626"
          >
            <p className="text-xs text-muted-foreground italic mb-3 leading-relaxed">
              AI will write a unique letter for each representative based on this subject.
            </p>
            <Textarea
              placeholder="e.g. subsidize residential solar installations nationwide"
              value={form.cause}
              onChange={(e) => updateForm({ cause: e.target.value })}
              rows={2}
              className="resize-none"
            />
            {form.cause.trim() && (
              <div className="text-sm text-gray-500 mt-2.5 leading-relaxed p-3 bg-gray-50 rounded-lg border border-gray-100">
                Each letter will urge the representative to:{" "}
                <span className="text-blue-500 font-semibold">{form.cause.trim()}</span>
              </div>
            )}
          </FormBlock>

          {/* ── Introduction ── */}
          <FormBlock num="2" numBg="#EDE9FE" numColor="#7C3AED" title="Introduction" badge="Optional">
            <p className="text-xs text-muted-foreground italic mb-3 leading-relaxed">
              Tell the AI about yourself so it can write a more credible, personalized letter.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Your Role / Title
                </label>
                <Input
                  placeholder="e.g. small business owner, teacher, parent"
                  value={form.senderRole}
                  onChange={(e) => updateForm({ senderRole: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Relevant Experience
                </label>
                <Textarea
                  placeholder="e.g. I have worked in renewable energy for 10 years..."
                  value={form.senderExperience}
                  onChange={(e) => updateForm({ senderExperience: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </FormBlock>

          {/* ── Impact ── */}
          <FormBlock num="3" numBg="#FEF3C7" numColor="#D97706" title="Impact" badge="Optional">
            <p className="text-xs text-muted-foreground italic mb-3 leading-relaxed">
              Help the AI explain why this issue matters. More detail produces stronger letters.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Desired Outcome
                </label>
                <Input
                  placeholder="e.g. pass the Clean Energy Act"
                  value={form.impactOutcome}
                  onChange={(e) => updateForm({ impactOutcome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Who is affected?
                </label>
                <Input
                  placeholder="e.g. homeowners, students, veterans"
                  value={form.impactStakeholder}
                  onChange={(e) => updateForm({ impactStakeholder: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Why does it matter?
                </label>
                <Input
                  placeholder="e.g. energy costs are rising 15% year-over-year"
                  value={form.impactReason}
                  onChange={(e) => updateForm({ impactReason: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  What difference would action make?
                </label>
                <Input
                  placeholder="e.g. could save families $2,000/year"
                  value={form.impactDifference}
                  onChange={(e) => updateForm({ impactDifference: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Supporting research or data
                </label>
                <Textarea
                  placeholder="e.g. According to the DOE..."
                  value={form.impactResearch}
                  onChange={(e) => updateForm({ impactResearch: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </FormBlock>

          {/* ── Bill Research ── */}
          <FormBlock
            num="4"
            numBg="#FDF2F8"
            numColor="#EC4899"
            title="Bill Research"
            badge="Optional"
            headerRight={
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-[11px] font-medium text-gray-500">Auto-research</label>
                <Switch
                  checked={form.autoResearch}
                  onCheckedChange={onAutoResearchToggle}
                />
              </div>
            }
          >
            <p className="text-xs text-muted-foreground italic mb-3 leading-relaxed">
              {form.autoResearch
                ? "AI will research real legislation related to your subject and reference it in each letter."
                : "Paste bill details below. They will be included in each letter."}
            </p>
            {form.autoResearch && previewBills.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {previewBills.slice(0, 4).map((bill: BillResult, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <span className="text-[11px] font-bold text-pink-500 font-mono flex-shrink-0">
                      {bill.bill_id}
                    </span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{bill.title}</span>
                    {bill.url && (
                      <a
                        href={bill.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 flex-shrink-0 hover:underline"
                      >
                        View →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            {billsLoading && (
              <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching for relevant legislation...
              </div>
            )}
            {!form.autoResearch && (
              <Textarea
                placeholder="e.g. H.R. 1234 — Clean Energy Act..."
                value={form.manualBillText}
                onChange={(e) => updateForm({ manualBillText: e.target.value })}
                rows={3}
                className="resize-none"
              />
            )}
          </FormBlock>

          {/* ── Letter Generation info ── */}
          <FormBlock
            num="5"
            numBg="#ECFDF5"
            numColor="#10B981"
            title="Letter Generation"
            badge="AI-Powered"
            badgeBg="#FEF3C7"
            badgeColor="#D97706"
          >
            <div className="text-sm text-gray-500 leading-[1.8]">
              Each letter will include:
              <br />• Personalized greeting with the representative's correct title
              <br />• Your subject presented as a constituent concern
              <br />• Relevant bill references matched to their level
              <br />• All office addresses (DC + district) for mail delivery
              <br />• Your name as the sender
              <br />
              <br />
              <span className="italic text-muted-foreground">
                Letters are generated by AI — no two will be identical.
              </span>
            </div>
          </FormBlock>

          {/* ── Start button ── */}
          <Button
            size="lg"
            className="mt-7 mb-10 w-auto px-8 font-semibold text-sm start-hover"
            disabled={!canStart}
            onClick={onStart}
          >
            Begin Volley →
          </Button>
        </div>
      </div>

      {/* Rep Finder Panel overlay */}
      <RepFinderPanel
        reps={richReps}
        enriching={enrichingReps}
        visible={repPanelVisible}
        onClose={() => onSetRepPanelVisible(false)}
      />
    </>
  );
}
