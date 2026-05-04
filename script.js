const CSV_FILES = [
  "memberships.csv",
  "membership.xls.csv",
  "membership-data.csv",
  "test report.csv"
];
const SOURCE_COLUMN = "active_membership_plan_type_name";
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

async function initDashboard() {
  try {
    const { csvText } = await loadDefaultCsv();
    processCsvText(csvText);
    hideError();
  } catch (error) {
    showError("The published dataset could not be loaded.");
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

  updateKpis(counts);
  renderCharts(counts);
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

function renderCharts(counts) {
  const pieCtx = document.getElementById("pieChart");
  const barCtx = document.getElementById("barChart");

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();

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
  for (const fileName of CSV_FILES) {
    const response = await fetch(fileName);
    if (response.ok) {
      return {
        csvText: await response.text(),
        fileName
      };
    }
  }

  throw new Error("No default CSV file was found.");
}

initDashboard();
