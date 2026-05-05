const CSV_FILES = [
  "memberships.csv",
  "membership.xls.csv",
  "membership-data.csv",
  "test report.csv"
];
const SOURCE_COLUMN = "active_membership_plan_type_name";
const SUBSCRIPTION_DATE_COLUMN = "active_membership_subscription_date";
const START_YEAR = 1991;
const END_YEAR = 2026;
const DISPLAY_LABELS = {
  Active: "Annual",
  Lifetime: "Lifetime",
  Other: "Other"
};

const COLUMN_LABELS = {
  aahoa_id: "AAHOA ID",
  name: "Name",
  city: "City",
  state: "State",
  mobile: "Mobile",
  company_name: "Company",
  address_line_one: "Address",
  active_membership_plan_type_name: "Plan Name",
  active_membership_subscription_date: "Subscription Date",
  region: "Region",
  zipcode: "ZIP Code",
  membership_type: "Membership Type"
};

let pieChart;
let barChart;
let yearChart;

async function initDashboard() {
  try {
    const { csvText } = await loadDefaultCsv();
    processCsvText(csvText);
    hideError();
  } catch (error) {
    showError(error.message);
  }
}

function processCsvText(csvText) {
  const rows = parseCsv(csvText);

  if (!rows.length) {
    throw new Error("The CSV file is empty.");
  }

  if (!Object.prototype.hasOwnProperty.call(rows[0], SOURCE_COLUMN)) {
    throw new Error(`Missing required column: ${SOURCE_COLUMN}`);
  }

  const enrichedRows = rows.map((row) => {
    const planName = row[SOURCE_COLUMN] ?? "";
    return {
      ...row,
      membership_type: getMembershipType(planName)
    };
  });

  const counts = enrichedRows.reduce(
    (totals, row) => {
      totals[row.membership_type] += 1;
      return totals;
    },
    { Active: 0, Lifetime: 0, Other: 0 }
  );
  const yearlyCounts = getYearlySubscriptionCounts(enrichedRows);

  updateKpis(counts);
  renderCharts(counts, yearlyCounts);
  renderTable(enrichedRows);
}

function getMembershipType(planName) {
  const value = String(planName).toLowerCase();

  if (value.includes("lifetime")) return "Lifetime";
  if (value.includes("annual")) return "Active";

  return "Other";
}

function updateKpis(counts) {
  document.getElementById("active-count").textContent = formatNumber(counts.Active);
  document.getElementById("lifetime-count").textContent = formatNumber(counts.Lifetime);
}

function renderCharts(counts, yearlyCounts) {
  const pieCtx = document.getElementById("pieChart");
  const barCtx = document.getElementById("barChart");
  const yearCtx = document.getElementById("yearChart");

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();
  if (yearChart) yearChart.destroy();

  pieChart = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: [DISPLAY_LABELS.Active, DISPLAY_LABELS.Lifetime],
      datasets: [
        {
          data: [counts.Active, counts.Lifetime],
          backgroundColor: ["#0f766e", "#d97706"],
          borderColor: ["#f8fafc", "#f8fafc"],
          borderWidth: 3
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 18,
            font: {
              family: "Space Grotesk"
            }
          }
        }
      }
    }
  });

  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: [DISPLAY_LABELS.Active, DISPLAY_LABELS.Lifetime, DISPLAY_LABELS.Other],
      datasets: [
        {
          label: "Membership count",
          data: [counts.Active, counts.Lifetime, counts.Other],
          backgroundColor: ["#0f766e", "#d97706", "#64748b"],
          borderRadius: 6,
          maxBarThickness: 70
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  yearChart = new Chart(yearCtx, {
    type: "bar",
    data: {
      labels: yearlyCounts.map((item) => item.year),
      datasets: [
        {
          label: "Subscriptions",
          data: yearlyCounts.map((item) => item.count),
          backgroundColor: "#1d4ed8",
          borderRadius: 5,
          maxBarThickness: 28
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function renderTable(rows) {
  const tableContainer = document.getElementById("table-container");
  const columns = Object.keys(rows[0]);

  const thead = `
    <thead>
      <tr>${columns.map((column) => `<th>${escapeHtml(getColumnLabel(column))}</th>`).join("")}</tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows
        .map((row) => {
          const cells = columns
            .map((column) => {
              if (column === "membership_type") {
                return `<td>${renderTypeBadge(row[column])}</td>`;
              }

              return `<td>${escapeHtml(row[column] ?? "")}</td>`;
            })
            .join("");

          return `<tr>${cells}</tr>`;
        })
        .join("")}
    </tbody>
  `;

  tableContainer.innerHTML = `<table>${thead}${tbody}</table>`;
}

function renderTypeBadge(type) {
  const className = {
    Active: "type-active",
    Lifetime: "type-lifetime",
    Other: "type-other"
  }[type] || "type-other";

  return `<span class="type-badge ${className}">${escapeHtml(getDisplayLabel(type))}</span>`;
}

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let current = "";
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      record.push(current);
      current = "";
    } else if (char === "\n" && !inQuotes) {
      record.push(current);
      if (record.some((value) => value !== "")) {
        rows.push(record);
      }
      record = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current !== "" || record.length) {
    record.push(current);
    if (record.some((value) => value !== "")) {
      rows.push(record);
    }
  }

  const [headerRow, ...dataRows] = rows;
  return dataRows.map((row) => {
    const entry = {};
    headerRow.forEach((header, index) => {
      entry[header] = row[index] ?? "";
    });
    return entry;
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getYearlySubscriptionCounts(rows) {
  const countsByYear = {};

  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    countsByYear[year] = 0;
  }

  rows.forEach((row) => {
    const year = getYearFromDate(row[SUBSCRIPTION_DATE_COLUMN]);
    if (year >= START_YEAR && year <= END_YEAR) {
      countsByYear[year] += 1;
    }
  });

  return Object.entries(countsByYear).map(([year, count]) => ({
    year,
    count
  }));
}

function getYearFromDate(value) {
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function getDisplayLabel(type) {
  return DISPLAY_LABELS[type] || type;
}

function getColumnLabel(column) {
  return COLUMN_LABELS[column] || toTitleCase(column);
}

function toTitleCase(value) {
  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function showError(message) {
  const banner = document.getElementById("error-banner");
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function hideError() {
  const banner = document.getElementById("error-banner");
  banner.textContent = "";
  banner.classList.add("hidden");
}

async function loadDefaultCsv() {
  const attemptedFiles = [];

  for (const fileName of CSV_FILES) {
    attemptedFiles.push(fileName);
    const response = await fetch(encodeURI(fileName));
    if (response.ok) {
      return {
        csvText: await response.text(),
        fileName
      };
    }
  }

  throw new Error(`The published dataset could not be loaded. Checked: ${attemptedFiles.join(", ")}.`);
}

initDashboard();

  throw new Error("No default CSV file was found.");
}

initDashboard();
