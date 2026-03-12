import { z } from "zod";

export const representativeSchema = z.object({
  name: z.string(),
  party: z.string().optional().default(""),
  chamber: z.string().optional().default(""),
  state: z.string().optional().default(""),
  district: z.string().nullable().optional(),
  level: z.string().optional().default("federal"),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  contactUrl: z.string().optional().default(""),
});

export type Representative = z.infer<typeof representativeSchema>;

export const batchLetterRequestSchema = z.object({
  subject: z.string().min(1),
  sender_name: z.string().min(1),
  reps: z.array(z.record(z.string(), z.any())),
  sender_role: z.string().optional(),
  sender_experience: z.string().optional(),
  impact_outcome: z.string().optional(),
  impact_stakeholder: z.string().optional(),
  impact_reason: z.string().optional(),
  impact_difference: z.string().optional(),
  impact_research: z.string().optional(),
  manual_bill_text: z.string().optional(),
});

export type BatchLetterRequest = z.infer<typeof batchLetterRequestSchema>;

export const postgridLetterSchema = z.object({
  to_name: z.string(),
  to_organization: z.string().optional(),
  to_address_line1: z.string(),
  to_address_line2: z.string().optional(),
  to_city: z.string(),
  to_state: z.string(),
  to_zip: z.string(),
  from_name: z.string(),
  from_address_line1: z.string().optional(),
  from_address_line2: z.string().optional(),
  from_city: z.string().optional(),
  from_state: z.string().optional(),
  from_zip: z.string().optional(),
  letter_html: z.string(),
  description: z.string().optional(),
});

export type PostGridLetter = z.infer<typeof postgridLetterSchema>;

export interface Office {
  label: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  type: string;
}

export interface EnrichedRep extends Representative {
  bio?: string;
  committee?: string;
  photoUrl?: string;
  stance?: string;
  relevance?: string;
  contactTip?: string;
  challenger?: string;
  challengerParty?: string;
  offices?: Office[];
}

export interface RepRow {
  id: string;
  name: string;
  full_name: string;
  state: string;
  level: string;
  chamber: string;
  district: string | null;
  party: string;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  offices: Office[];
  senderName: string | null;
  letter: string | null;
  billData: BillResult | null;
  stance: string | null;
  relevance: string | null;
  contactTip: string | null;
}

export interface Phase {
  id: string;
  num: number;
  label: string;
  color: string;
  bg: string;
}

export interface BillResult {
  bill_id: string;
  title: string;
  summary?: string;
  status?: string;
  url?: string;
  sponsor?: string;
}

export interface SonarLookupResult {
  representatives: Representative[];
  location: string;
  error?: string;
}
