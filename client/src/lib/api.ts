import { parseJsonSafe } from "@shared/utils";
import type { Representative, EnrichedRep, BatchLetterRequest, SonarLookupResult } from "@shared/schema";

type NamedRep = { name: string; full_name?: string; chamber?: string; state?: string };

async function sonarQuery(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1500,
) {
  const r = await fetch("/api/sonar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: systemPrompt,
      user: userPrompt,
      maxTokens,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: `Sonar ${r.status}` }));
    throw new Error(err.error || `Sonar ${r.status}`);
  }
  const data = await r.json();
  return data.content;
}

function stripCites(s: string) {
  return s
    ? s
        .replace(/\[\d+\]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    : "";
}

export async function lookupReps(address: string): Promise<SonarLookupResult> {
  try {
    const raw = await sonarQuery(
      "You are a US civics data assistant. Given a ZIP code or address, search the web and return a JSON object with 'representatives' (array) and 'location' (string describing the area). Each representative should have: name, party, chamber (Senate/House/State Senate/State House), state (2-letter), district (e.g. 'CA-12' or null for senators), level (federal/state), phone (office phone or empty string), email (or empty string), contactUrl (official .gov URL or empty string). Include both federal (2 senators + house rep) AND state legislators. Return ONLY valid JSON, no markdown.",
      `Look up all current elected representatives for ZIP code: ${address}`,
      3000,
    );
    const parsed = parseJsonSafe(raw);
    if (parsed && parsed.representatives) {
      return parsed;
    } else if (parsed && Array.isArray(parsed)) {
      return { representatives: parsed, location: address };
    } else {
      return { representatives: [], location: address, error: "Could not parse response" };
    }
  } catch (e: any) {
    console.error("Sonar rep lookup error:", e);
    return { representatives: [], location: address, error: e.message };
  }
}

export async function searchBills(params: {
  subject: string;
  level?: string;
  state?: string;
  count?: number;
}) {
  const searchParams = new URLSearchParams({
    subject: params.subject,
    level: params.level || "federal",
    count: String(params.count || 3),
  });
  if (params.state) searchParams.set("state", params.state);
  const r = await fetch(`/api/bills/search?${searchParams}`);
  if (r.ok) return r.json();
  return [];
}

export async function batchLetters(payload: BatchLetterRequest) {
  const r = await fetch(`/api/letter/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (r.ok) return r.json();
  return {};
}

async function sonarFetchBio(desc: string): Promise<{ bio: string; committee: string }> {
  try {
    const raw = await sonarQuery(
      "You are a civic research assistant. Return ONLY a JSON object with 'bio' and 'committee' fields. No markdown.",
      `Search the web for a biography of this elected official: ${desc}\n\nReturn JSON: {"bio":"2-3 sentence biography","committee":"their most relevant or notable committee assignment"}`,
      800,
    );
    const parsed = parseJsonSafe(raw);
    if (parsed && !Array.isArray(parsed)) {
      return {
        bio: stripCites(parsed.bio || ""),
        committee: stripCites(parsed.committee || ""),
      };
    }
  } catch (err) {
    console.warn(`Bio fetch failed for ${desc}:`, err);
  }
  return { bio: "", committee: "" };
}

async function sonarFetchContact(desc: string): Promise<{ phone: string; email: string; contactUrl: string; photoUrl: string }> {
  try {
    const raw = await sonarQuery(
      "You are a civic data tool. Search the web for this official's contact info. Return ONLY a JSON object. No markdown.",
      `Find the official contact information for: ${desc}\n\nReturn JSON: {"phone":"main office phone number","email":"official email address or empty string","contactUrl":"official .gov website URL","photoUrl":"URL to their official portrait photo or Wikipedia photo, or empty string"}`,
      600,
    );
    const parsed = parseJsonSafe(raw);
    if (parsed && !Array.isArray(parsed)) {
      return {
        phone: (parsed.phone || "").trim(),
        email: (parsed.email || "").trim(),
        contactUrl: (parsed.contactUrl || parsed.contact_url || parsed.website || "").trim(),
        photoUrl: (parsed.photoUrl || parsed.photo_url || parsed.photo || "").trim(),
      };
    }
  } catch (err) {
    console.warn(`Contact fetch failed for ${desc}:`, err);
  }
  return { phone: "", email: "", contactUrl: "", photoUrl: "" };
}

export async function sonarFetchStance(desc: string, issue: string): Promise<{ stance: string; relevance: string; contactTip: string }> {
  try {
    const raw = await sonarQuery(
      "You are a civic research assistant. Search the web for this official's position on a specific issue. Return ONLY a JSON object. No markdown.",
      `What is the position of ${desc} on "${issue}"?\n\nSearch their voting record, public statements, and committee work.\n\nReturn JSON: {"stance":"1-2 sentences on their position or voting record on this issue","relevance":"1 sentence on why they matter for this issue","contactTip":"practical tip for a constituent reaching them about this"}`,
      800,
    );
    const parsed = parseJsonSafe(raw);
    if (parsed && !Array.isArray(parsed)) {
      return {
        stance: stripCites(parsed.stance || ""),
        relevance: stripCites(parsed.relevance || ""),
        contactTip: stripCites(parsed.contactTip || parsed.contact_tip || ""),
      };
    }
  } catch (err) {
    console.warn(`Stance fetch failed for ${desc}:`, err);
  }
  return { stance: "", relevance: "", contactTip: "" };
}

async function sonarFetchChallenger(desc: string): Promise<{ challenger: string; challengerParty: string }> {
  try {
    const raw = await sonarQuery(
      "You are a civic research assistant. Return ONLY a JSON object. No markdown.",
      `Who is the most prominent challenger or opponent of ${desc} in their most recent or upcoming election?\n\nReturn JSON: {"challenger":"full name of challenger or empty string if none known","challengerParty":"party of challenger or empty string"}`,
      400,
    );
    const parsed = parseJsonSafe(raw);
    if (parsed && !Array.isArray(parsed)) {
      return {
        challenger: stripCites(parsed.challenger || ""),
        challengerParty: stripCites(parsed.challengerParty || parsed.challenger_party || ""),
      };
    }
  } catch (err) {
    console.warn(`Challenger fetch failed for ${desc}:`, err);
  }
  return { challenger: "", challengerParty: "" };
}

export async function enrichOneRep(rep: Representative): Promise<EnrichedRep> {
  const desc = `${rep.name} (${rep.chamber || ""}, ${rep.party || ""}, ${rep.state}${rep.district ? ", " + rep.district : ""})`;

  const [bioResult, contactResult, challengerResult] = await Promise.all([
    sonarFetchBio(desc),
    sonarFetchContact(desc),
    sonarFetchChallenger(desc),
  ]);

  return {
    ...rep,
    bio: bioResult.bio,
    committee: bioResult.committee,
    phone: (rep.phone || contactResult.phone).trim(),
    email: (rep.email || contactResult.email).trim(),
    contactUrl: (rep.contactUrl || contactResult.contactUrl).trim(),
    photoUrl: contactResult.photoUrl,
    challenger: challengerResult.challenger,
    challengerParty: challengerResult.challengerParty,
  };
}

export async function enrichOneRepAddresses(rep: Representative): Promise<EnrichedRep> {
  const desc = `${rep.name} (${rep.chamber || ""}, ${rep.party || ""}, ${rep.state}${rep.district ? ", " + rep.district : ""})`;
  try {
    const raw = await sonarQuery(
      "You are a US civic data tool. Search the web for this official's office addresses. Return ONLY a JSON object. No markdown.",
      `Find ALL office addresses for ${desc}.\n\nSearch for their Washington DC office AND every district/state office. Most members of Congress have a DC office plus 1-3 district offices.\n\nReturn JSON: {"offices":[{"label":"Washington, DC Office","address_line1":"street address","address_line2":"suite or room if any, or empty string","city":"city","state":"2-letter state code","zip":"ZIP code","phone":"office phone","type":"dc"},{"label":"District Office Name","address_line1":"street","address_line2":"","city":"city","state":"XX","zip":"XXXXX","phone":"phone","type":"district"}]}`,
      2000,
    );
    const parsed = parseJsonSafe(raw);
    if (!parsed) return { ...rep, offices: [] };
    const offices = Array.isArray(parsed.offices)
      ? parsed.offices
      : Array.isArray(parsed)
        ? parsed
        : [];
    const cleaned = offices
      .map((o: any) => ({
        label: stripCites(o.label || o.name || "Office"),
        address_line1: stripCites(o.address_line1 || o.address || ""),
        address_line2: stripCites(o.address_line2 || o.suite || ""),
        city: stripCites(o.city || ""),
        state: (o.state || "").trim().toUpperCase(),
        zip: (o.zip || o.postal_code || o.zipcode || "").toString().trim(),
        phone: (o.phone || "").trim(),
        type: (o.type || "district").toLowerCase(),
      }))
      .filter((o: any) => o.address_line1 && o.city && o.state);
    return { ...rep, offices: cleaned };
  } catch (err) {
    console.warn(`Address enrichment failed for ${rep.name}:`, err);
    return { ...rep, offices: [] };
  }
}

export async function enrichRepsViaSonar(reps: Representative[]): Promise<EnrichedRep[]> {
  return Promise.all(reps.map((rep) => enrichOneRep(rep)));
}

export async function sonarFetchPOBox(zip: string): Promise<{ addressLine1: string; city: string; state: string; postalOrZip: string }> {
  try {
    const raw = await sonarQuery(
      "You are a US postal data assistant. Return ONLY a JSON object. No markdown.",
      `Find a USPS Post Office or PO Box rental location in or near ZIP code ${zip}. I need a real, valid mailing address I can use as a return address.\n\nReturn JSON: {"addressLine1":"street address of the post office","city":"city","state":"2-letter state code","postalOrZip":"5-digit ZIP code"}`,
      400,
    );
    const parsed = parseJsonSafe(raw);
    if (parsed && !Array.isArray(parsed) && parsed.addressLine1 && parsed.city && parsed.state) {
      return {
        addressLine1: stripCites(parsed.addressLine1 || ""),
        city: stripCites(parsed.city || ""),
        state: (parsed.state || "").trim().toUpperCase(),
        postalOrZip: (parsed.postalOrZip || parsed.zip || zip).toString().trim(),
      };
    }
  } catch (err) {
    console.warn(`PO Box lookup failed for ${zip}:`, err);
  }
  return { addressLine1: "General Delivery", city: "", state: "", postalOrZip: zip };
}

export function getInitials(name: string) {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatRepTitle(rep: NamedRep) {
  const ch = rep.chamber || "";
  if (ch === "Senate") return "Sen.";
  if (ch === "House") return "Rep.";
  if (ch === "State Senate") return "State Sen.";
  if (ch === "State House") return "State Rep.";
  return "Rep.";
}

export function formatRepName(rep: NamedRep) {
  return `${formatRepTitle(rep)} ${rep.full_name || rep.name}`;
}

export function parseReturnAddress(addrString: string, name: string) {
  const base = {
    name,
    addressLine1: "",
    addressLine2: "",
    city: "",
    provinceOrState: "",
    postalOrZip: "",
    country: "US",
  };
  if (!addrString || !addrString.trim()) return base;
  const parts = addrString.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    base.addressLine1 = parts[0];
    const lastPart = parts[parts.length - 1];
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
    if (stateZipMatch) {
      base.provinceOrState = stateZipMatch[1];
      base.postalOrZip = stateZipMatch[2];
      if (parts.length >= 3) base.city = parts[parts.length - 2];
    } else {
      if (parts.length >= 3) {
        base.city = parts[1];
        const szm = parts[2].match(/([A-Z]{2})\s*(\d{5})/);
        if (szm) {
          base.provinceOrState = szm[1];
          base.postalOrZip = szm[2];
        } else base.provinceOrState = parts[2];
      } else {
        base.city = lastPart;
      }
    }
    if (parts.length >= 4) base.addressLine2 = parts[1];
  } else {
    base.addressLine1 = addrString;
  }
  return base;
}

export function localLetterFallback(rep: NamedRep, cause: string, senderName: string) {
  const isSenate = rep.chamber === "Senate" || rep.chamber === "State Senate";
  const salutation = isSenate ? "Senator" : "Representative";
  const lastName = (rep.full_name || rep.name || "").split(" ").slice(-1)[0];
  return `Dear ${salutation} ${lastName},\n\nAs a constituent, I am writing to urge your attention to ${cause}.\n\nThis issue directly impacts families and communities in ${rep.state || "our state"}. I believe meaningful action on this matter is both necessary and timely.\n\nI respectfully ask that you prioritize this issue and take action to address it.\n\nI look forward to hearing from you.\n\nSincerely,\n${senderName}`;
}

export function escapeHTML(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
