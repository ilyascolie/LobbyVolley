import { useState, useRef } from "react";
import {
  Check,
  CheckSquare,
  Square,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Mail,
  Edit3,
  Copy,
  Download,
  Send,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RepRow } from "@shared/schema";
import { parseReturnAddress, escapeHTML, sonarFetchPOBox } from "@/lib/api";

type ModalPhase = "confirm" | "sending" | "done";
type MobileView = "list" | "letter";

// ── Send Volley Modal ─────────────────────────────────────────────────────────

function SendVolleyModal({
  rows,
  selected,
  editedLetters,
  senderFullName,
  returnAddress,
  zipCode,
  onClose,
  onFinish,
}: {
  rows: RepRow[];
  selected: Set<string>;
  editedLetters: Record<string, string>;
  senderFullName: string;
  returnAddress: string;
  zipCode: string;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [phase, setPhase] = useState<ModalPhase>("confirm");
  const [email, setEmail] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [errors, setErrors] = useState<{ rep: string; office: string; error: string }[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [letterIds, setLetterIds] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const totalOffices = selectedRows.reduce((sum, r) => sum + Math.max((r.offices || []).length, 1), 0);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendVolley = async () => {
    setPhase("sending");
    setProgress(0);
    setStatusText("Preparing letters...");

    let senderAddr = parseReturnAddress(returnAddress, senderFullName);

    if (!senderAddr.addressLine1 || !senderAddr.city || !senderAddr.provinceOrState) {
      setStatusText("No return address provided — finding a nearby PO Box...");
      try {
        const poBox = await sonarFetchPOBox(zipCode);
        senderAddr = {
          ...senderAddr,
          addressLine1: poBox.addressLine1,
          city: poBox.city,
          provinceOrState: poBox.state,
          postalOrZip: poBox.postalOrZip,
        };
      } catch {
        senderAddr = {
          ...senderAddr,
          addressLine1: "General Delivery",
          postalOrZip: zipCode,
        };
      }
    }

    let completed = 0;
    let successes = 0;
    let total = 0;
    const errs: { rep: string; office: string; error: string }[] = [];
    const ids: string[] = [];

    for (const rep of selectedRows) {
      const letter = editedLetters[rep.id] || "";
      const offices = rep.offices || [];
      const letterHtml = `<html><body><div style="font-family:serif;font-size:12pt;line-height:1.8;white-space:pre-wrap">${escapeHTML(letter)}</div></body></html>`;

      if (offices.length === 0) {
        total++;
        setTotalCount(total);
        completed++;
        setProgress(Math.round((completed / totalOffices) * 100));
        setStatusText(`Skipping ${rep.name} — no office address found`);
        errs.push({ rep: rep.name, office: "N/A", error: "No office address available" });
        continue;
      }

      for (const office of offices) {
        total++;
        setTotalCount(total);
        setStatusText(`Sending to ${rep.name} — ${office.label}... (${completed + 1} of ${totalOffices})`);

        try {
          const resp = await fetch("/api/postgrid/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_name: rep.full_name || rep.name,
              to_organization: office.label || rep.chamber || "",
              to_address_line1: office.address_line1,
              to_address_line2: office.address_line2 || "",
              to_city: office.city,
              to_state: office.state,
              to_zip: office.zip,
              from_name: senderFullName,
              from_address_line1: senderAddr.addressLine1,
              from_address_line2: senderAddr.addressLine2 || "",
              from_city: senderAddr.city,
              from_state: senderAddr.provinceOrState,
              from_zip: senderAddr.postalOrZip,
              letter_html: letterHtml,
              description: `Letter to ${rep.name} — ${office.label}`,
            }),
          });

          const data = await resp.json();
          if (data.error) {
            errs.push({ rep: rep.name, office: office.label, error: data.error });
          } else {
            successes++;
            if (data.id) ids.push(data.id);
          }
        } catch (e: any) {
          errs.push({ rep: rep.name, office: office.label, error: e.message });
        }

        completed++;
        setSuccessCount(successes);
        setProgress(Math.round((completed / totalOffices) * 100));
      }
    }

    setErrors(errs);
    setLetterIds(ids);

    setPhase("done");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "sending") onClose(); }}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[500px] mx-0 sm:mx-4 shadow-2xl overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "confirm" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-xl font-bold">Send Volley</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
              <div className="text-sm font-semibold text-blue-800 mb-2">
                You're about to send {selectedRows.length} letter{selectedRows.length !== 1 ? "s" : ""} to {totalOffices} office{totalOffices !== 1 ? "s" : ""}
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {selectedRows.map((rep) => (
                  <div key={rep.id} className="flex items-center gap-2">
                    <span className="text-xs text-blue-700">{rep.name}</span>
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">
                      {Math.max((rep.offices || []).length, 1)} office{(rep.offices || []).length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                <Mail className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                Your email (for delivery updates)
              </label>
              <Input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                We'll email you status updates as your letters are printed and delivered.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <Button
                disabled={!isEmailValid}
                onClick={handleSendVolley}
                className="font-semibold"
              >
                Send Volley ✉️
              </Button>
            </div>
          </div>
        )}

        {phase === "sending" && (
          <div className="p-6">
            <h2 className="font-serif text-xl font-bold mb-5">Sending Letters...</h2>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-600">{statusText}</span>
            </div>
            {errors.length > 0 && (
              <div className="space-y-1">
                {errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-500">
                    ✕ {err.rep} — {err.office}: {err.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-emerald-500" />
            </div>
            <h2 className="font-serif text-2xl font-bold mb-2">Volley Sent!</h2>
            <p className="text-sm text-gray-600 mb-4">
              {successCount} of {totalCount} letter{totalCount !== 1 ? "s" : ""} sent successfully
            </p>
            {errors.length > 0 && (
              <div className="mb-4">
                <button
                  className="flex items-center gap-1.5 mx-auto text-sm text-amber-600 font-medium hover:text-amber-700"
                  onClick={() => setShowErrors(!showErrors)}
                >
                  <AlertTriangle className="w-4 h-4" />
                  {errors.length} letter{errors.length !== 1 ? "s" : ""} failed to send
                  <span className="text-xs">{showErrors ? "▾" : "▸"}</span>
                </button>
                {showErrors && (
                  <div className="mt-2 bg-amber-50 rounded-lg p-3 border border-amber-200 text-left max-h-[150px] overflow-y-auto">
                    {errors.map((err, i) => (
                      <div key={i} className="text-xs text-amber-700 mb-1">
                        <span className="font-semibold">{err.rep}</span> — {err.office}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {email && (
              <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mb-5">
                <Check className="w-4 h-4 text-emerald-500" />
                Updates will be sent to <span className="font-medium text-gray-700">{email}</span>
              </div>
            )}
            <Button onClick={onFinish} className="font-semibold">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SendScreen ────────────────────────────────────────────────────────────────

export default function SendScreen({
  rows,
  senderFullName,
  returnAddress,
  zipCode,
  onBack,
  onFinish,
}: {
  rows: RepRow[];
  senderFullName: string;
  returnAddress: string;
  zipCode: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [viewing, setViewing] = useState(rows[0]?.id || "");
  const [selected, setSelected] = useState<Set<string>>(new Set(rows.map((r) => r.id)));
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [editedLetters, setEditedLetters] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    rows.forEach((r) => { m[r.id] = r.letter || ""; });
    return m;
  });
  const [editing, setEditing] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentLetter = editedLetters[viewing] || "";
  const viewingRep = rows.find((r) => r.id === viewing);

  const toggleRep = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  };

  const handleLetterChange = (text: string) => {
    setEditedLetters((prev) => ({ ...prev, [viewing]: text }));
  };

  const handleCopyAll = () => {
    const txt = rows
      .filter((r) => selected.has(r.id))
      .map((r) => `— To: ${r.name} —\n\n${editedLetters[r.id] || ""}`)
      .join("\n\n──────────────────────\n\n");
    navigator.clipboard.writeText(txt).then(() => {
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  const handlePostGridExport = () => {
    const selectedRows = rows.filter((r) => selected.has(r.id));
    const senderAddr = parseReturnAddress(returnAddress, senderFullName);
    const mailItems: any[] = [];

    for (const rep of selectedRows) {
      const letter = editedLetters[rep.id] || "";
      const offices = rep.offices || [];
      if (offices.length === 0) {
        mailItems.push({
          description: `Letter to ${rep.name}`,
          to: {
            name: rep.full_name || rep.name,
            organization: rep.chamber || "",
            addressLine1: "Address not found",
            addressLine2: "",
            city: "",
            provinceOrState: rep.state || "",
            postalOrZip: "",
            country: "US",
          },
          from: senderAddr,
          letterHTML: `<div style="font-family:serif;font-size:12pt;line-height:1.8;white-space:pre-wrap">${escapeHTML(letter)}</div>`,
          letterText: letter,
          metadata: {
            repName: rep.full_name || rep.name,
            chamber: rep.chamber,
            party: rep.party,
            state: rep.state,
            district: rep.district,
            officeType: "unknown",
          },
        });
      } else {
        for (const office of offices) {
          mailItems.push({
            description: `Letter to ${rep.name} — ${office.label}`,
            to: {
              name: rep.full_name || rep.name,
              organization: office.label || "",
              addressLine1: office.address_line1,
              addressLine2: office.address_line2 || "",
              city: office.city,
              provinceOrState: office.state,
              postalOrZip: office.zip,
              country: "US",
            },
            from: senderAddr,
            letterHTML: `<div style="font-family:serif;font-size:12pt;line-height:1.8;white-space:pre-wrap">${escapeHTML(letter)}</div>`,
            letterText: letter,
            metadata: {
              repName: rep.full_name || rep.name,
              chamber: rep.chamber,
              party: rep.party,
              state: rep.state,
              district: rep.district,
              officeType: office.type,
              officeLabel: office.label,
              officePhone: office.phone || "",
            },
          });
        }
      }
    }

    const payload = {
      _meta: {
        generatedAt: new Date().toISOString(),
        senderName: senderFullName,
        totalLetters: mailItems.length,
        totalReps: selectedRows.length,
        note: "Each item in 'letters' can be sent via PostGrid's /v1/letters API.",
      },
      letters: mailItems,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lobbyvolley-postgrid-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMsg(`Exported ${mailItems.length} mail items`);
    setTimeout(() => setExportMsg(""), 3000);
  };

  // ── Shared Send Volley button ─────────────────────────────────────────────
  const sendVolleyBtn = (
    <Button
      disabled={selected.size === 0}
      onClick={() => setShowModal(true)}
      className="font-semibold"
    >
      <Send className="w-4 h-4 mr-1.5" />
      Send Volley ✉️
    </Button>
  );

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {showModal && (
        <SendVolleyModal
          rows={rows}
          selected={selected}
          editedLetters={editedLetters}
          senderFullName={senderFullName}
          returnAddress={returnAddress}
          zipCode={zipCode}
          onClose={() => setShowModal(false)}
          onFinish={onFinish}
        />
      )}

      {/* ── Left / list panel ── */}
      <div
        className={`
          ${mobileView === "list" ? "flex" : "hidden"} md:flex
          w-full md:w-[340px] flex-col bg-white md:border-r border-border flex-shrink-0
        `}
      >
        {/* List header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 flex-shrink-0">
          <button
            className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors flex items-center gap-1"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="text-xs text-blue-500 font-semibold hover:text-blue-700"
              onClick={toggleAll}
            >
              {selected.size === rows.length ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs text-muted-foreground">
              {selected.size}/{rows.length}
            </span>
          </div>
        </div>

        {/* Rep list */}
        <ScrollArea className="flex-1">
          {rows.map((rep) => {
            const isSelected = selected.has(rep.id);
            const isSent = sent.has(rep.id);
            const isViewing = viewing === rep.id;
            return (
              <div
                key={rep.id}
                className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${isViewing ? "bg-[#EDE9E3]" : ""}`}
                style={{ borderLeft: isViewing ? "3px solid #1a1a1a" : "3px solid transparent" }}
                onClick={() => {
                  setViewing(rep.id);
                  setEditing(false);
                  setMobileView("letter");
                }}
              >
                <button
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRep(rep.id);
                  }}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{rep.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {rep.state} · {rep.chamber}
                    {rep.offices && rep.offices.length > 0 && (
                      <span className="text-amber-500 ml-1">
                        · {rep.offices.length} office{rep.offices.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                {isSent ? (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    Sent
                  </span>
                ) : (
                  <>
                    <span className="hidden md:block text-[11px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      Edit letter
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </>
                )}
              </div>
            );
          })}
        </ScrollArea>

        {/* List footer — mobile: Send Volley; desktop: sender info + actions */}
        <div className="flex-shrink-0 border-t border-border bg-white">
          {/* Mobile footer */}
          <div className="md:hidden px-5 py-3.5 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {selected.size} of {rows.length} selected
            </span>
            {sendVolleyBtn}
          </div>

          {/* Desktop footer */}
          <div className="hidden md:flex px-5 py-3.5 flex-col gap-2">
            <div className="text-xs text-muted-foreground leading-relaxed truncate">
              Sending as: {senderFullName}
              {returnAddress && <span> · {returnAddress}</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleCopyAll}
              >
                <Copy className="w-3 h-3 mr-1" />
                {copyMsg || "Copy All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handlePostGridExport}
              >
                <Download className="w-3 h-3 mr-1" />
                {exportMsg || "Export JSON"}
              </Button>
              {sendVolleyBtn}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right / letter panel ── */}
      <div
        className={`
          ${mobileView === "letter" ? "flex" : "hidden"} md:flex
          flex-1 flex-col overflow-hidden bg-background min-w-0
        `}
      >
        {/* Letter header */}
        <div className="px-5 py-3.5 border-b border-border bg-white flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: back to list */}
            <button
              className="md:hidden flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setEditing(false); setMobileView("list"); }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {viewingRep && (
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{viewingRep.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {viewingRep.party} · {viewingRep.chamber} · {viewingRep.state}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant={editing ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setEditing(!editing)}
            >
              {editing ? (
                <><Check className="w-3 h-3 mr-1" /> Done</>
              ) : (
                <><Edit3 className="w-3 h-3 mr-1" /> Edit</>
              )}
            </Button>
          </div>
        </div>

        {/* Letter body */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {editing ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full min-h-[400px] p-4 md:p-5 border border-border rounded-xl font-mono text-xs leading-[1.8] text-gray-700 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              value={currentLetter}
              onChange={(e) => handleLetterChange(e.target.value)}
            />
          ) : (
            <div
              className="bg-white rounded-xl border border-border p-4 md:p-6 font-mono text-xs leading-[1.8] text-gray-700 whitespace-pre-wrap break-words min-h-[300px]"
            >
              {currentLetter || (
                <span className="text-muted-foreground italic">
                  Select a representative to preview their letter
                </span>
              )}
            </div>
          )}
        </div>

        {/* Letter footer */}
        <div className="px-5 py-3.5 border-t border-border bg-white flex items-center justify-between flex-shrink-0 gap-3 flex-wrap">
          {/* Mobile: just Send Volley */}
          <div className="flex md:hidden items-center gap-2 w-full justify-between">
            <span className="text-xs text-muted-foreground">{selected.size}/{rows.length} selected</span>
            {sendVolleyBtn}
          </div>

          {/* Desktop: full footer */}
          <div className="hidden md:flex items-center justify-between w-full gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground leading-relaxed">
              Sending as: {senderFullName}
              {returnAddress && <span> · Return: {returnAddress}</span>}
              {exportMsg && <span className="text-emerald-500 font-semibold ml-2">{exportMsg}</span>}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleCopyAll}
              >
                <Copy className="w-3 h-3 mr-1" />
                {copyMsg || "Copy All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handlePostGridExport}
              >
                <Download className="w-3 h-3 mr-1" />
                {exportMsg || "Export JSON"}
              </Button>
              {sendVolleyBtn}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
