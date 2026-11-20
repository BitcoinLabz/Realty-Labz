import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";
import type { DepreciationBasis, HomeOfficeYearResult } from "@/lib/home-office";

// The Home Office report (2026-11-19): its own PDF, separate from the
// accountant summary, which links here. Laid out so an accountant can check
// every number against Form 8829 without asking how it was worked out.

const colors = { text: "#1d1d1f", muted: "#6e6e73", border: "#d2d2d7", success: "#17733f", warning: "#a05a00" };

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 70, fontSize: 10, color: colors.text, fontFamily: "Helvetica" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  meta: { fontSize: 9, color: colors.muted, marginBottom: 16 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8 },
  summaryLabel: { fontSize: 7.5, color: colors.muted, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  banner: { borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 9.5 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 3,
  },
  sub: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 },
  line: { flexDirection: "row", paddingVertical: 2 },
  lineLabel: { flex: 1, fontSize: 9 },
  lineValue: { width: 90, fontSize: 9, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: colors.muted },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: colors.muted },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 3 },
  thr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.text, paddingBottom: 3, marginBottom: 2 },
  td: { fontSize: 9 },
  note: { fontSize: 8.5, color: colors.muted, marginTop: 6 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: colors.muted,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
});

export type HomeOfficeReportExpense = {
  label: string;
  when: string;
  scope: "DIRECT" | "INDIRECT";
  amount: number;
  receiptName: string | null;
  receiptUrl: string | null;
  /** False for a bill from before business use began: listed, not counted. */
  counted: boolean;
};

export type HomeOfficeReportData = {
  agentName: string;
  year: number;
  generatedAt: string;
  officeSqFt: number;
  homeSqFt: number | null;
  businessPercent: number | null;
  businessUseStart: string | null;
  ownership: "OWN" | "RENT";
  current: HomeOfficeYearResult;
  chain: HomeOfficeYearResult[];
  basis: DepreciationBasis | null;
  recapture: number;
  status: { tone: "success" | "warning" | "neutral"; text: string };
  expenses: HomeOfficeReportExpense[];
  eligibility: { regularUse: boolean | null; exclusiveUse: boolean | null; principalPlace: boolean | null };
};

function Line({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, ...(bold ? [styles.bold] : []), ...(indent ? [{ paddingLeft: 10 }] : [])]}>{label}</Text>
      <Text style={[styles.lineValue, ...(bold ? [styles.bold] : [])]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const pctText = (p: number | null) => (p == null ? "—" : `${(p * 100).toFixed(2)}%`);
const yesNo = (v: boolean | null) => (v === true ? "Yes" : v === false ? "No" : "Not answered");

export function HomeOfficeReport({ data }: { data: HomeOfficeReportData }) {
  const { current: c, year } = data;
  const r = c.regular;
  const s = c.simplified;
  const pct = r.businessPercent;

  return (
    <Document title={`Home Office Report ${year}`} author="Realty Labz">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Home Office Report — {year}</Text>
        <Text style={styles.meta}>
          {data.agentName} · Generated {data.generatedAt} · Federal rules (Michigan follows federal for this deduction)
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tax year</Text>
            <Text style={styles.summaryValue}>{year}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Method used</Text>
            <Text style={styles.summaryValue}>{c.method === "REGULAR" ? "Regular (8829)" : "Simplified"}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Business use</Text>
            <Text style={styles.summaryValue}>{pctText(data.businessPercent)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Allowed deduction</Text>
            <Text style={styles.summaryValue}>{formatCurrency(c.allowed)}</Text>
          </View>
        </View>

        <Text
          style={[
            styles.banner,
            data.status.tone === "success"
              ? { backgroundColor: "#e8f5ee", color: colors.success }
              : data.status.tone === "warning"
                ? { backgroundColor: "#fdf3e4", color: colors.warning }
                : { backgroundColor: "#f4f6f8", color: colors.muted },
          ]}
        >
          {data.status.text}
        </Text>

        <Text style={styles.sectionTitle}>The space</Text>
        <Text style={styles.td}>
          Office: {data.officeSqFt.toLocaleString()} sq ft of a {data.homeSqFt?.toLocaleString() ?? "—"} sq ft home (
          {pctText(data.businessPercent)} business use)
        </Text>
        <Text style={styles.note}>
          Business use began: {data.businessUseStart ?? "before this year (in use all year)"} · {data.ownership === "OWN" ? "Owned" : "Rented"} ·
          Regular use: {yesNo(data.eligibility.regularUse)} · Exclusive use: {yesNo(data.eligibility.exclusiveUse)} · Principal place
          for admin: {yesNo(data.eligibility.principalPlace)}
        </Text>

        <Text style={styles.sectionTitle}>Simplified vs. regular</Text>
        <View style={styles.thr}>
          <Text style={[styles.th, { flex: 1 }]}>Method</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Before limit</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Allowed {year}</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Carried forward</Text>
        </View>
        <View style={styles.tr}>
          <Text style={[styles.td, { flex: 1 }]}>
            Simplified: {s.sqFtUsed} sq ft × ${s.ratePerSqFt} × {s.monthsInUse}/12
          </Text>
          <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{formatCurrency(s.tentative)}</Text>
          <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{formatCurrency(s.allowed)}</Text>
          <Text style={[styles.td, { width: 90, textAlign: "right" }]}>None</Text>
        </View>
        <View style={styles.tr}>
          <Text style={[styles.td, { flex: 1 }]}>Regular (Form 8829)</Text>
          <Text style={[styles.td, { width: 90, textAlign: "right" }]}>
            {formatCurrency(r.tierOne.businessShare + r.tierTwo.total + r.tierThree.total)}
          </Text>
          <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{formatCurrency(r.allowed)}</Text>
          <Text style={[styles.td, { width: 90, textAlign: "right" }]}>
            {formatCurrency(r.carryOut.operating + r.carryOut.depreciation)}
          </Text>
        </View>
        <Text style={styles.note}>Recommended: {c.recommended === "REGULAR" ? "Regular" : "Simplified"}. {c.recommendationReason}</Text>

        <Text style={styles.sectionTitle}>Form 8829 logic (regular method)</Text>
        <Line label="Business profit before home office (Schedule C, before line 30)" value={c.tentativeProfit} />
        <Line label="Line 8 — income limit (not below zero)" value={r.incomeLimit} bold />
        <Text style={styles.sub}>Mortgage interest & real estate taxes (allowed regardless of profit)</Text>
        <Line label="Direct (office only)" value={r.tierOne.direct} indent />
        <Line label={`Indirect (whole home) ${formatCurrency(r.tierOne.indirect)} × ${pctText(pct)}`} value={r.tierOne.indirect * pct} indent />
        <Line label="Line 14 — allowed" value={r.tierOne.businessShare} bold />
        <Line label="Line 15 — income left" value={r.afterTierOne} />
        <Text style={styles.sub}>Operating expenses</Text>
        <Line label="Direct (office only)" value={r.tierTwo.direct} indent />
        <Line label={`Indirect (whole home) ${formatCurrency(r.tierTwo.indirect)} × ${pctText(pct)}`} value={r.tierTwo.indirect * pct} indent />
        <Line label="Line 25 — operating carryover from prior year" value={r.tierTwo.carryIn} indent />
        <Line label="Line 27 — allowed" value={r.tierTwo.allowed} bold />
        <Line label="Line 28 — income left" value={r.afterTierTwo} />
        <Text style={styles.sub}>Depreciation</Text>
        <Line label="Line 30 — depreciation this year" value={r.tierThree.depreciation} indent />
        <Line label="Line 31 — depreciation carryover from prior year" value={r.tierThree.carryIn} indent />
        <Line label="Line 33 — allowed" value={r.tierThree.allowed} bold />
        <Line label="Line 36 — total allowable (regular method)" value={r.allowed} bold />
        <Line label="Line 43 — operating expenses carried to next year" value={r.carryOut.operating} />
        <Line label="Line 44 — depreciation carried to next year" value={r.carryOut.depreciation} />

        {data.basis ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Depreciation schedule</Text>
            <Line label="Purchase price + improvements - land (adjusted basis)" value={data.basis.adjustedBasis} />
            {data.basis.fairMarketBuildingValue != null ? (
              <Line label="Fair market value when business use began, less land" value={data.basis.fairMarketBuildingValue} />
            ) : null}
            <Line label="Basis (lesser of the two; land excluded)" value={data.basis.basis} />
            <Line label={`Business basis (${pctText(data.basis.businessPercent)}) — 39-year straight line, mid-month`} value={data.basis.businessBasis} bold />
            <View style={[styles.thr, { marginTop: 6 }]}>
              <Text style={[styles.th, { flex: 1 }]}>Year</Text>
              <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Depreciation</Text>
              <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Deducted</Text>
              <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Accumulated</Text>
            </View>
            {data.chain.map((y) => (
              <View key={y.year} style={styles.tr}>
                <Text style={[styles.td, { flex: 1 }]}>
                  {y.year}
                  {y.method === "SIMPLIFIED" ? " (simplified — none taken)" : ""}
                </Text>
                <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{formatCurrency(y.regular.tierThree.depreciation)}</Text>
                <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{formatCurrency(y.depreciationTaken)}</Text>
                <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{formatCurrency(y.accumulatedDepreciation)}</Text>
              </View>
            ))}
            {data.recapture > 0 ? (
              <Text style={styles.note}>
                Depreciation deducted may be recaptured when the home is sold: up to {formatCurrency(data.recapture)} at the
                25% maximum rate, even if the rest of the gain is excluded.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Carryovers</Text>
          <View style={styles.thr}>
            <Text style={[styles.th, { flex: 1 }]}>Year</Text>
            <Text style={[styles.th, { width: 70, textAlign: "right" }]}>Method</Text>
            <Text style={[styles.th, { width: 80, textAlign: "right" }]}>Allowed</Text>
            <Text style={[styles.th, { width: 80, textAlign: "right" }]}>Carry in</Text>
            <Text style={[styles.th, { width: 80, textAlign: "right" }]}>Carry out</Text>
          </View>
          {data.chain.map((y) => (
            <View key={y.year} style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>{y.year}</Text>
              <Text style={[styles.td, { width: 70, textAlign: "right" }]}>{y.method === "REGULAR" ? "Regular" : "Simplified"}</Text>
              <Text style={[styles.td, { width: 80, textAlign: "right" }]}>{formatCurrency(y.allowed)}</Text>
              <Text style={[styles.td, { width: 80, textAlign: "right" }]}>{formatCurrency(y.carryIn.operating + y.carryIn.depreciation)}</Text>
              <Text style={[styles.td, { width: 80, textAlign: "right" }]}>{formatCurrency(y.carryOut.operating + y.carryOut.depreciation)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Supporting records</Text>
        {data.expenses.length === 0 ? (
          <Text style={[styles.td, styles.muted]}>No home costs entered for {year}.</Text>
        ) : (
          <>
            <View style={styles.thr}>
              <Text style={[styles.th, { flex: 1 }]}>Cost</Text>
              <Text style={[styles.th, { width: 95 }]}>Period</Text>
              <Text style={[styles.th, { width: 55 }]}>Type</Text>
              <Text style={[styles.th, { width: 75, textAlign: "right" }]}>Amount</Text>
              <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Receipt</Text>
            </View>
            {data.expenses.map((e, i) => (
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={[styles.td, { flex: 1 }]}>{e.label}</Text>
                <Text style={[styles.td, { width: 95 }]}>
                  {e.when}
                  {e.counted ? "" : " (before business use; not counted)"}
                </Text>
                <Text style={[styles.td, { width: 55 }]}>{e.scope === "DIRECT" ? "Direct" : "Indirect"}</Text>
                <Text style={[styles.td, { width: 75, textAlign: "right" }]}>{formatCurrency(e.amount)}</Text>
                {e.receiptUrl ? (
                  <Link src={e.receiptUrl} style={[styles.td, { width: 90, textAlign: "right", color: "#0071e3" }]}>
                    {e.receiptName && e.receiptName.length > 18 ? `${e.receiptName.slice(0, 17)}…` : e.receiptName}
                  </Link>
                ) : (
                  <Text style={[styles.td, styles.muted, { width: 90, textAlign: "right" }]}>—</Text>
                )}
              </View>
            ))}
            <Text style={styles.note}>
              Receipt links open in Realty Labz and require signing in to {data.agentName}&apos;s account.
            </Text>
          </>
        )}

        <Text style={styles.footer} fixed>
          For record-keeping and review by your accountant — not tax advice. Figures follow IRS Publication 587 and Form
          8829 as entered by the taxpayer; verify before filing. Realty Labz
        </Text>
      </Page>
    </Document>
  );
}
