import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";
import type { CdaLines } from "@/lib/cda";

// Commission disbursement authorization (2026-10-02): the one page an office
// sends the title company so commission is paid out correctly at closing.
// Brand navy/blue (globals.css), print-friendly.

const colors = { text: "#16192e", muted: "#5e6b80", border: "#d7dee6", accent: "#0b6fb8", fill: "#f3f6f9" };

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10, color: colors.text, fontFamily: "Helvetica" },
  brand: { fontSize: 9, color: colors.accent, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: colors.muted, marginBottom: 22 },
  sectionLabel: { fontSize: 8, color: colors.muted, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  cell: { width: "50%", marginBottom: 8, paddingRight: 12 },
  cellLabel: { fontSize: 8, color: colors.muted, marginBottom: 2 },
  cellValue: { fontSize: 10.5 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.fill },
  rowLabel: { fontSize: 10 },
  rowValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  note: { fontSize: 8.5, color: colors.muted, marginBottom: 28, lineHeight: 1.4 },
  signatures: { flexDirection: "row", gap: 24 },
  signature: { flex: 1 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: colors.text, height: 26, marginBottom: 4 },
  signatureLabel: { fontSize: 8.5, color: colors.muted },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, fontSize: 7.5, color: colors.muted },
});

export type CdaData = {
  brokerageName: string;
  agentName: string;
  propertyAddress: string;
  clientName: string | null;
  side: string;
  salePrice: number | null;
  closingDate: string | null;
  titleCompany: string | null;
  referralPartner: string | null;
  lines: CdaLines;
  generatedOn: string;
};

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value || "—"}</Text>
    </View>
  );
}

function Line({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <View style={last ? styles.rowLast : styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

export function CdaDocument({ data }: { data: CdaData }) {
  const { lines } = data;
  return (
    <Document title={`Commission disbursement — ${data.propertyAddress}`}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>{data.brokerageName.toUpperCase()}</Text>
        <Text style={styles.title}>Commission Disbursement Authorization</Text>
        <Text style={styles.subtitle}>
          Please disburse the commission for the transaction below at closing, as authorized.
        </Text>

        <Text style={styles.sectionLabel}>TRANSACTION</Text>
        <View style={styles.grid}>
          <Cell label="Property" value={data.propertyAddress} />
          <Cell label="Closing date" value={data.closingDate} />
          <Cell label="Agent" value={data.agentName} />
          <Cell label="Representing" value={data.side} />
          <Cell label="Client" value={data.clientName} />
          <Cell label="Sale price" value={data.salePrice !== null ? formatCurrency(data.salePrice) : null} />
          <Cell label="Title company" value={data.titleCompany} />
          <Cell label="Brokerage" value={data.brokerageName} />
        </View>

        <Text style={styles.sectionLabel}>DISBURSEMENT</Text>
        <View style={styles.table}>
          <Line label="Gross commission" value={lines.gross} />
          {lines.brokerage ? <Line label={`To ${data.brokerageName}`} value={lines.brokerage} /> : null}
          {lines.referral ? (
            <Line label={`Referral fee${data.referralPartner ? ` — ${data.referralPartner}` : ""}`} value={lines.referral} />
          ) : null}
          {lines.team ? <Line label="Team split" value={lines.team} /> : null}
          {lines.other ? <Line label="Other deductions" value={lines.other} /> : null}
          <Line label={`To ${data.agentName}`} value={lines.agentNet} last />
        </View>

        <Text style={styles.note}>
          Amounts are calculated from the commission and splits recorded on this transaction and add up
          exactly to the gross commission. Verify against the final closing statement before disbursing.
        </Text>

        <View style={styles.signatures}>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Broker · {data.brokerageName}</Text>
          </View>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Agent · {data.agentName}</Text>
          </View>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>

        <Text style={styles.footer}>Prepared with Realty Labz on {data.generatedOn}.</Text>
      </Page>
    </Document>
  );
}
