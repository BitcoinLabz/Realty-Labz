import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";

const colors = {
  text: "#1d1d1f",
  muted: "#6e6e73",
  border: "#d2d2d7",
  accent: "#0071e3",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: colors.text,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 1,
  },
  meta: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
  },
  summaryLabel: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  categoryTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 3,
    marginBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 3,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
  },
  tableCell: {
    fontSize: 9,
  },
  colDate: { width: "15%" },
  colDescription: { flex: 1 },
  colMiles: { width: "12%", textAlign: "right" },
  colRate: { width: "13%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  subtotalRow: {
    flexDirection: "row",
    paddingTop: 4,
    marginBottom: 6,
  },
  subtotalLabel: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingRight: 8,
  },
  subtotalValue: {
    width: "15%",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  emptyNote: {
    fontSize: 9,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: colors.muted,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
});

export type FinancialReportItem = {
  date: string;
  description: string;
  amount: number;
};

export type FinancialReportExpenseCategory = {
  label: string;
  total: number;
  items: FinancialReportItem[];
};

export type FinancialReportMileageTrip = {
  date: string;
  note: string | null;
  miles: number;
  ratePerMile: number;
  deduction: number;
};

export type FinancialReportData = {
  userName: string;
  teamName?: string | null;
  year: number;
  income: number;
  expenses: number;
  mileageDeduction: number;
  netIncome: number;
  incomeItems: FinancialReportItem[];
  expenseCategories: FinancialReportExpenseCategory[];
  mileageTrips: FinancialReportMileageTrip[];
  generatedAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FinancialReport({ data }: { data: FinancialReportData }) {
  const businessMiles = data.mileageTrips.reduce((sum, t) => sum + t.miles, 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{data.userName}</Text>
        <Text style={styles.subtitle}>
          {data.teamName ? `${data.teamName} · ` : ""}Financial Summary — {data.year}
        </Text>
        <Text style={styles.meta}>Generated {data.generatedAt} · Realty Labs</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>INCOME</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.income)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>EXPENSES</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.expenses)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>MILEAGE DEDUCTION</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.mileageDeduction)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>NET INCOME</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.netIncome)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Income</Text>
        {data.incomeItems.length === 0 ? (
          <Text style={styles.emptyNote}>No income recorded for {data.year}.</Text>
        ) : (
          <>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>DATE</Text>
              <Text style={[styles.tableHeaderCell, styles.colDescription]}>DESCRIPTION</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>AMOUNT</Text>
            </View>
            {data.incomeItems.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDate]}>{formatDate(item.date)}</Text>
                <Text style={[styles.tableCell, styles.colDescription]}>
                  {item.description || "—"}
                </Text>
                <Text style={[styles.tableCell, styles.colAmount]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Total income</Text>
              <Text style={styles.subtotalValue}>{formatCurrency(data.income)}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Expenses</Text>
        {data.expenseCategories.length === 0 ? (
          <Text style={styles.emptyNote}>No expenses recorded for {data.year}.</Text>
        ) : (
          <>
            {data.expenseCategories.map((cat) => (
              <View key={cat.label}>
                <Text style={styles.categoryTitle}>{cat.label}</Text>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>DATE</Text>
                  <Text style={[styles.tableHeaderCell, styles.colDescription]}>DESCRIPTION</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAmount]}>AMOUNT</Text>
                </View>
                {cat.items.map((item, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colDate]}>{formatDate(item.date)}</Text>
                    <Text style={[styles.tableCell, styles.colDescription]}>
                      {item.description || "—"}
                    </Text>
                    <Text style={[styles.tableCell, styles.colAmount]}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                ))}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal — {cat.label}</Text>
                  <Text style={styles.subtotalValue}>{formatCurrency(cat.total)}</Text>
                </View>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Total expenses</Text>
              <Text style={styles.subtotalValue}>{formatCurrency(data.expenses)}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Mileage</Text>
        {data.mileageTrips.length === 0 ? (
          <Text style={styles.emptyNote}>No deductible business trips recorded for {data.year}.</Text>
        ) : (
          <>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>DATE</Text>
              <Text style={[styles.tableHeaderCell, styles.colDescription]}>NOTE</Text>
              <Text style={[styles.tableHeaderCell, styles.colMiles]}>MILES</Text>
              <Text style={[styles.tableHeaderCell, styles.colRate]}>RATE</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>DEDUCTION</Text>
            </View>
            {data.mileageTrips.map((trip, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDate]}>{formatDate(trip.date)}</Text>
                <Text style={[styles.tableCell, styles.colDescription]}>
                  {trip.note || "Business trip"}
                </Text>
                <Text style={[styles.tableCell, styles.colMiles]}>{trip.miles}</Text>
                <Text style={[styles.tableCell, styles.colRate]}>
                  ${trip.ratePerMile.toFixed(3)}
                </Text>
                <Text style={[styles.tableCell, styles.colAmount]}>
                  {formatCurrency(trip.deduction)}
                </Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>
                Total — {businessMiles.toLocaleString()} business miles
              </Text>
              <Text style={styles.subtotalValue}>{formatCurrency(data.mileageDeduction)}</Text>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Generated by Realty Labs. Michigan mileage deductions are calculated using the IRS
          standard mileage rate in effect on each trip&apos;s date. Personal trips are excluded.
          This summary is for informational purposes — consult your accountant or tax preparer
          before filing.
        </Text>
      </Page>
    </Document>
  );
}
