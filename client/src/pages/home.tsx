import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/logo.png";
import type { RepRow, Phase, Representative, EnrichedRep, SonarLookupResult, BillResult } from "@shared/schema";
import {
  lookupReps,
  searchBills,
  batchLetters,
  enrichRepsViaSonar,
  enrichOneRepAddresses,
  sonarFetchStance,
  formatRepName,
  localLetterFallback,
} from "@/lib/api";
import SendScreen from "@/components/send-screen";
import ChooseScreen from "@/components/choose-screen";
import StartScreen from "@/components/start-screen";
import type { FormState } from "@/components/start-screen";
import CampaignLoader from "@/components/campaign-loader";

// ── Types ─────────────────────────────────────────────────────────────────────

type ScreenState = "choose" | "start" | "loading" | "ready" | "send";

const PHASES: Phase[] = [
  { id: "reps",      num: 1, label: "Finding Reps",      color: "#3B82F6", bg: "#EFF6FF" },
  { id: "bills",     num: 2, label: "Researching Bills",  color: "#EC4899", bg: "#FDF2F8" },
  { id: "addresses", num: 3, label: "Finding Addresses",  color: "#F59E0B", bg: "#FFFBEB" },
  { id: "letters",   num: 4, label: "Generating Letters", color: "#10B981", bg: "#ECFDF5" },
];

const INITIAL_FORM: FormState = {
  cause: "",
  senderFullName: "",
  returnAddress: "",
  senderRole: "",
  senderExperience: "",
  impactOutcome: "",
  impactStakeholder: "",
  impactReason: "",
  impactDifference: "",
  impactResearch: "",
  autoResearch: true,
  manualBillText: "",
};

// ── PhaseChip (header-only, stays here) ──────────────────────────────────────

function PhaseChip({
  phase,
  active,
  done,
  pct,
}: {
  phase: Phase;
  active: boolean;
  done: boolean;
  pct: number;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300"
      style={{
        borderColor: done ? phase.color + "40" : active ? phase.color + "30" : "#E5E2DB",
        background: done ? phase.bg : active ? phase.bg : "#fff",
      }}
    >
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "animate-pulse" : ""}`}
        style={{ background: done ? phase.color : active ? phase.color : "#D5D0C8" }}
      />
      <div>
        <div
          className="text-[11px] font-semibold"
          style={{ color: done || active ? phase.color : "#9CA3AF" }}
        >
          {phase.num}. {phase.label}
        </div>
        {active && (
          <div className="w-20 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: phase.color }}
            />
          </div>
        )}
        {done && (
          <div className="text-[10px] font-medium" style={{ color: phase.color, opacity: 0.7 }}>
            ✓ Complete
          </div>
        )}
      </div>
    </div>
  );
}

// ── Home (router + state) ─────────────────────────────────────────────────────

export default function Home() {
  // ── Screen ──────────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<ScreenState>("choose");

  // ── Grouped form state ───────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const updateForm = useCallback((updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── ZIP state (separate — array manipulation) ────────────────────────────────
  const [zipCodes, setZipCodes] = useState([""]);

  // ── Sonar / rep lookup state ─────────────────────────────────────────────────
  const [sonarResults, setSonarResults] = useState<SonarLookupResult | null>(null);
  const [sonarLoading, setSonarLoading] = useState(false);
  const [sonarError, setSonarError] = useState<string | null>(null);
  const [richReps, setRichReps] = useState<EnrichedRep[]>([]);
  const [repPanelVisible, setRepPanelVisible] = useState(false);
  const [enrichingReps, setEnrichingReps] = useState(false);

  // ── Bill preview state ───────────────────────────────────────────────────────
  const [previewBills, setPreviewBills] = useState<BillResult[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);

  // ── Pipeline state ───────────────────────────────────────────────────────────
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState<Record<string, number>>({});
  const [phaseDone, setPhaseDone] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<RepRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<RepRow | null>(null);
  const [logLines, setLogLines] = useState<{ msg: string; color: string; ts: number }[]>([]);

  // ── Misc ─────────────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, color: string) => {
    setLogLines((prev) => [...prev.slice(-120), { msg, color, ts: Date.now() }]);
  }, []);

  const addZip = useCallback(() => setZipCodes((prev) => [...prev, ""]), []);
  const updateZip = useCallback((idx: number, val: string) => {
    setZipCodes((prev) =>
      prev.map((z, i) => (i === idx ? val.replace(/\D/g, "").slice(0, 5) : z)),
    );
  }, []);
  const removeZip = useCallback((idx: number) => {
    setZipCodes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }, []);

  // ── Rep lookup ───────────────────────────────────────────────────────────────
  const handleLookupReps = useCallback(async () => {
    const validZips = zipCodes.filter((z) => z.length === 5);
    if (validZips.length === 0) return;

    setSonarLoading(true);
    setSonarError(null);
    setSonarResults(null);
    setRichReps([]);
    setRepPanelVisible(false);
    setEnrichingReps(false);

    const allReps: Representative[] = [];
    const seenKeys = new Set<string>();
    const errors: string[] = [];

    for (const zip of validZips) {
      const result = await lookupReps(zip);
      if (result.error) {
        errors.push(`${zip}: ${result.error}`);
      } else {
        for (const rep of result.representatives || []) {
          const key = `${rep.name}-${rep.district}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allReps.push(rep);
          }
        }
      }
    }

    setSonarLoading(false);

    if (errors.length > 0 && allReps.length === 0) {
      setSonarError(errors.join("; "));
      return;
    }

    setSonarResults({ representatives: allReps, location: validZips.join(", ") });
    setRichReps(allReps);
    setRepPanelVisible(true);

    if (allReps.length > 0) {
      setEnrichingReps(true);
      try {
        const enriched = await enrichRepsViaSonar(allReps);
        setRichReps(enriched);
      } catch (e) {
        console.warn("Rep enrichment failed:", e);
      }
      setEnrichingReps(false);
    }
  }, [zipCodes]);

  // ── Bill auto-research toggle ────────────────────────────────────────────────
  const handleAutoResearchToggle = useCallback(
    async (on: boolean) => {
      updateForm({ autoResearch: on });
      if (on && form.cause.trim()) {
        setBillsLoading(true);
        try {
          const bills = await searchBills({ subject: form.cause, level: "federal", count: 3 });
          setPreviewBills(bills);
        } catch {
          setPreviewBills([]);
        }
        setBillsLoading(false);
      } else if (!on) {
        setPreviewBills([]);
      }
    },
    [form, updateForm],
  );

  // ── sonarRepToRow ────────────────────────────────────────────────────────────
  const sonarRepToRow = useCallback(
    (rep: Representative, idx: number, richRep: EnrichedRep | undefined): RepRow => ({
      id: `sonar-${idx}-${rep.name}`,
      name: formatRepName(rep),
      full_name: rep.name,
      state: rep.state,
      level: rep.level === "federal" ? "Federal" : "State",
      chamber: rep.chamber,
      district: rep.district ?? null,
      party: rep.party,
      website_url: richRep?.contactUrl || null,
      email: richRep?.email || null,
      phone: richRep?.phone || null,
      offices: richRep?.offices || [],
      senderName: null,
      letter: null,
      billData: null,
      stance: null,
      relevance: null,
      contactTip: null,
    }),
    [],
  );

  // ── Pipeline ─────────────────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (!sonarResults || sonarResults.representatives.length === 0) return;
    const reps = sonarResults.representatives;
    const richLookup: Record<string, EnrichedRep> = {};
    richReps.forEach((r: EnrichedRep) => { richLookup[r.name] = r; });

    let allRows = reps.map((rep: Representative, i: number) =>
      sonarRepToRow(rep, i, richLookup[rep.name]),
    );

    addLog(`→ Phase 1: ${reps.length} representatives found via Sonar`, "#3B82F6");
    for (const rep of reps)
      addLog(`  ✓ ${rep.name} (${rep.party}, ${rep.chamber})`, "#3B82F6");
    setRows([...allRows]);
    setPhaseProgress((p) => ({ ...p, reps: 100 }));
    setPhaseDone((p) => ({ ...p, reps: true }));
    setCurrentPhase(1);
    if (cancelRef.current) return;

    addLog("  ↳ Fetching issue stances for each rep…", "#8B5CF6");
    try {
      const stanceResults = await Promise.all(
        reps.map((rep: Representative) => {
          const desc = `${rep.name} (${rep.chamber || ""}, ${rep.party || ""}, ${rep.state}${rep.district ? ", " + rep.district : ""})`;
          return sonarFetchStance(desc, form.cause);
        }),
      );
      for (let i = 0; i < allRows.length; i++) {
        allRows[i] = {
          ...allRows[i],
          stance: stanceResults[i].stance || null,
          relevance: stanceResults[i].relevance || null,
          contactTip: stanceResults[i].contactTip || null,
        };
        if (stanceResults[i].stance) addLog(`  ✓ ${reps[i].name}: stance found`, "#8B5CF6");
      }
      setRows([...allRows]);
    } catch (e: any) {
      addLog(`  ⚠ Stance enrichment error: ${e.message}`, "#F59E0B");
    }
    if (cancelRef.current) return;

    await new Promise((r) => setTimeout(r, 400));
    addLog("→ Phase 2: Researching relevant legislation via Sonar...", "#EC4899");
    setPhaseProgress((p) => ({ ...p, bills: 20 }));
    const billMap: Record<string, BillResult[]> = {};
    try {
      const fedBills = await searchBills({ subject: form.cause, level: "federal", count: 3 });
      addLog(`  ✓ ${fedBills.length} federal bill(s) found`, "#EC4899");
      billMap.federal = fedBills;
      setPhaseProgress((p) => ({ ...p, bills: 50 }));
      const states = Array.from(new Set(reps.map((r: Representative) => r.state))) as string[];
      for (const st of states) {
        const sb = await searchBills({ subject: form.cause, level: "state", state: st, count: 2 });
        addLog(`  ✓ ${sb.length} bill(s) found for ${st}`, "#EC4899");
        billMap[st] = sb;
      }
    } catch (e: any) {
      addLog(`  ⚠ Bill research error: ${e.message}`, "#F59E0B");
    }
    for (let i = 0; i < allRows.length; i++) {
      const rep = reps[i];
      const repBills =
        rep.level === "federal"
          ? billMap.federal || []
          : billMap[rep.state] || billMap.federal || [];
      allRows[i] = { ...allRows[i], billData: repBills.length > 0 ? repBills[0] : null };
    }
    setRows([...allRows]);
    setPhaseProgress((p) => ({ ...p, bills: 100 }));
    setPhaseDone((p) => ({ ...p, bills: true }));
    setCurrentPhase(2);
    if (cancelRef.current) return;

    await new Promise((r) => setTimeout(r, 400));
    addLog("→ Phase 3: Finding ALL office addresses for each rep via Sonar...", "#F59E0B");
    setPhaseProgress((p) => ({ ...p, addresses: 10 }));

    try {
      let completed = 0;
      const addrResults = await Promise.all(
        reps.map(async (rep: Representative, idx: number) => {
          if (allRows[idx].offices && allRows[idx].offices.length > 0) {
            completed++;
            setPhaseProgress((p) => ({
              ...p,
              addresses: 10 + Math.round((completed / reps.length) * 85),
            }));
            addLog(`  ✓ ${rep.name}: ${allRows[idx].offices.length} office(s) (cached)`, "#F59E0B");
            return allRows[idx];
          }
          const enriched = await enrichOneRepAddresses(rep);
          completed++;
          setPhaseProgress((p) => ({
            ...p,
            addresses: 10 + Math.round((completed / reps.length) * 85),
          }));
          const officeCount = enriched.offices?.length || 0;
          addLog(`  ✓ ${rep.name}: ${officeCount} office(s) found`, "#F59E0B");
          return { ...allRows[idx], offices: enriched.offices || [] };
        }),
      );
      for (let i = 0; i < allRows.length; i++) {
        allRows[i] = {
          ...addrResults[i],
          senderName: form.senderFullName,
          phone: addrResults[i].phone || addrResults[i].offices?.[0]?.phone || null,
        };
      }
    } catch (e: any) {
      addLog(`  ⚠ Address enrichment error: ${e.message}`, "#F59E0B");
    }
    for (let i = 0; i < allRows.length; i++) {
      allRows[i] = { ...allRows[i], senderName: form.senderFullName };
    }
    setRows([...allRows]);
    const totalOffices = allRows.reduce(
      (sum: number, r: RepRow) => sum + (r.offices?.length || 0),
      0,
    );
    addLog(`  ✓ ${totalOffices} total office(s) found across ${allRows.length} reps`, "#F59E0B");
    setPhaseProgress((p) => ({ ...p, addresses: 100 }));
    setPhaseDone((p) => ({ ...p, addresses: true }));
    setCurrentPhase(3);
    if (cancelRef.current) return;

    await new Promise((r) => setTimeout(r, 400));
    addLog(`→ Phase 4: Generating ${allRows.length} personalized letters...`, "#10B981");
    setPhaseProgress((p) => ({ ...p, letters: 10 }));
    const letterReps = allRows.map((row: RepRow, i: number) => {
      const rep = reps[i];
      const bill = row.billData;
      return {
        name: rep.name,
        party: rep.party,
        chamber: rep.chamber,
        level: rep.level,
        state: rep.state,
        district: rep.district,
        ...(bill
          ? { bill_id: bill.bill_id, bill_title: bill.title, bill_summary: bill.summary }
          : {}),
      };
    });
    const letterResults = await batchLetters({
      subject: form.cause,
      sender_name: form.senderFullName,
      reps: letterReps,
      sender_role: form.senderRole || undefined,
      sender_experience: form.senderExperience || undefined,
      impact_outcome: form.impactOutcome || undefined,
      impact_stakeholder: form.impactStakeholder || undefined,
      impact_reason: form.impactReason || undefined,
      impact_difference: form.impactDifference || undefined,
      impact_research: form.impactResearch || undefined,
      manual_bill_text: !form.autoResearch && form.manualBillText.trim() ? form.manualBillText : undefined,
    });
    for (let i = 0; i < allRows.length; i++) {
      const repName = reps[i].name;
      allRows[i] = {
        ...allRows[i],
        letter: letterResults[repName] || localLetterFallback(reps[i], form.cause, form.senderFullName),
      };
    }
    addLog(`  ✓ ${allRows.length} letter(s) generated`, "#10B981");
    setRows([...allRows]);
    setPhaseProgress((p) => ({ ...p, letters: 100 }));
    setPhaseDone((p) => ({ ...p, letters: true }));

    addLog("", "#aaa");
    addLog("  Summary", "#10B981");
    addLog(`  ${allRows.length} representatives`, "#10B981");
    const repsWithOffices = allRows.filter(
      (r: RepRow) => r.offices && r.offices.length > 0,
    ).length;
    const totalOfficesFinal = allRows.reduce(
      (sum: number, r: RepRow) => sum + (r.offices?.length || 0),
      0,
    );
    addLog(`  ${repsWithOffices} reps with office addresses (${totalOfficesFinal} total offices)`, "#F59E0B");
    addLog(`  ${allRows.filter((r: RepRow) => r.letter).length} letters generated`, "#10B981");
    addLog(`  ${allRows.filter((r: RepRow) => r.billData).length} with bill references`, "#EC4899");
    setTimeout(() => setScreen("ready"), 600);
  }, [sonarResults, richReps, form, addLog, sonarRepToRow]);

  // ── Start load ───────────────────────────────────────────────────────────────
  const startLoad = useCallback(async () => {
    if (!form.cause.trim() || !form.senderFullName.trim()) return;
    setRepPanelVisible(false);
    setScreen("loading");
    setRows([]);
    setCurrentPhase(0);
    setPhaseProgress({});
    setPhaseDone({});
    setLogLines([]);
    setError(null);
    cancelRef.current = false;
    addLog(
      `→ Mode: Mail My Reps (${sonarResults?.representatives.length ?? 0} reps from ZIP ${zipCodes.filter((z) => z.length === 5).join(", ")})`,
      "#EC4899",
    );
    await runPipeline();
  }, [form, sonarResults, zipCodes, runPipeline, addLog]);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  useEffect(() => {
    if (scrollRef.current && screen === "loading")
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows.length, screen]);

  useEffect(() => {
    if (selectedRow) {
      const updated = rows.find((r) => r.id === selectedRow.id);
      if (updated && updated !== selectedRow) setSelectedRow(updated);
    }
  }, [rows, selectedRow]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const validZips = zipCodes.filter((z) => z.length === 5);
  const scopeReady = sonarResults && sonarResults.representatives.length > 0;
  const canStart = !!(form.cause.trim() && form.senderFullName.trim() && scopeReady);

  // ── Navigation callbacks ──────────────────────────────────────────────────────
  const handleGoToStart = useCallback(() => {
    setSonarResults(null);
    setSonarError(null);
    setRichReps([]);
    setRepPanelVisible(false);
    setScreen("start");
  }, []);

  const handleBackToChoose = useCallback(() => {
    setScreen("choose");
    setSonarResults(null);
    setSonarError(null);
    setRichReps([]);
    setRepPanelVisible(false);
    updateForm({ cause: "", senderFullName: "" });
    setPreviewBills([]);
  }, [updateForm]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background font-sans text-foreground overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center gap-4 px-6 py-3 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-3">
          <img
            src={logoPath}
            alt="LobbyVolley"
            className="w-9 h-9 object-cover rounded-lg cursor-pointer"
            onClick={() => setScreen("choose")}
          />
          <span
            className="font-serif text-xl tracking-tight cursor-pointer"
            onClick={() => setScreen("choose")}
          >
            LobbyVolley
          </span>
          {(screen === "loading" || screen === "ready") && (
            <>
              <span className="text-border text-lg font-light">/</span>
              <span className="text-muted-foreground text-sm">Campaign Loader</span>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-1 flex-wrap">
          {(screen === "loading" || screen === "ready") &&
            PHASES.map((ph, i) => (
              <PhaseChip
                key={ph.id}
                phase={ph}
                active={currentPhase === i && screen === "loading"}
                done={phaseDone[ph.id] === true}
                pct={phaseProgress[ph.id] || 0}
              />
            ))}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2.5">
          {screen === "ready" && (
            <span
              className="text-xs font-medium text-emerald-500 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full animate-fadeIn"
            >
              Ready to send
            </span>
          )}
          {screen === "start" && sonarResults && sonarResults.representatives.length > 0 && (
            <Button
              variant={repPanelVisible ? "default" : "outline"}
              size="sm"
              className="rounded-full text-xs font-semibold"
              onClick={() => setRepPanelVisible((v) => !v)}
            >
              {enrichingReps ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <User className="w-3 h-3 mr-1" />
              )}
              {repPanelVisible ? "Hide Profiles" : `View ${richReps.length} Profiles`}
            </Button>
          )}
        </div>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-50 text-red-600 px-6 py-2.5 flex items-center justify-between text-sm border-b border-red-200 animate-fadeIn">
          <span>⚠ {error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500"
            onClick={() => { setError(null); setScreen("start"); }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Screen routing ── */}
      {screen === "choose" && (
        <ChooseScreen onStart={handleGoToStart} />
      )}

      {screen === "start" && (
        <StartScreen
          form={form}
          updateForm={updateForm}
          zipCodes={zipCodes}
          validZips={validZips}
          sonarResults={sonarResults}
          sonarLoading={sonarLoading}
          sonarError={sonarError}
          richReps={richReps}
          repPanelVisible={repPanelVisible}
          enrichingReps={enrichingReps}
          previewBills={previewBills}
          billsLoading={billsLoading}
          canStart={canStart}
          onAddZip={addZip}
          onUpdateZip={updateZip}
          onRemoveZip={removeZip}
          onLookupReps={handleLookupReps}
          onAutoResearchToggle={handleAutoResearchToggle}
          onStart={startLoad}
          onBack={handleBackToChoose}
          onSetRepPanelVisible={setRepPanelVisible}
        />
      )}

      {(screen === "loading" || screen === "ready") && (
        <CampaignLoader
          screen={screen}
          rows={rows}
          selectedRow={selectedRow}
          currentPhase={currentPhase}
          phaseProgress={phaseProgress}
          phaseDone={phaseDone}
          logLines={logLines}
          scrollRef={scrollRef}
          logRef={logRef}
          onSelectRow={setSelectedRow}
          onProceedToSend={() => setScreen("send")}
        />
      )}

      {screen === "send" && (
        <SendScreen
          rows={rows}
          senderFullName={form.senderFullName}
          returnAddress={form.returnAddress.trim()}
          zipCode={validZips[0] || ""}
          onBack={() => setScreen("ready")}
          onFinish={() => {
            setScreen("choose");
            setForm(INITIAL_FORM);
            setRows([]);
          }}
        />
      )}
    </div>
  );
}
