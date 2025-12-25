import { BaldaError } from "../errors/balda_error.js";
import type cronstrueType from "cronstrue";
import { CronService } from "./cron.js";

export type CronJobDisplay = {
  name: string;
  schedule: string;
  humanReadable?: string;
};

export class CronUI {
  static cronstrue: { default: typeof cronstrueType } | null = null;

  static async getCronstrue(): Promise<{ default: typeof cronstrueType }> {
    if (!this.cronstrue) {
      this.cronstrue = await import("cronstrue").catch(() => {
        throw new BaldaError(
          "cronstrue not installed as a dependency, it is required in order to consult cron jobs in UI",
        );
      });
    }

    return this.cronstrue;
  }

  /**
   * Generates an HTML UI displaying cron jobs in a modern dashboard style
   */
  async generate(): Promise<string> {
    const cronstrue = await CronUI.getCronstrue();

    const jobs = CronService.scheduledJobs;

    // Extract unique values for filters
    const frequencies = new Set<string>();
    const timezones = new Set<string>();

    const jobsData = jobs.map((job) => {
      const frequency = cronstrue.default.toString(job.args[0]) || "-";
      const timezone =
        (job.args[2] as { timezone?: string })?.timezone || "System Default";
      frequencies.add(frequency);
      timezones.add(timezone);
      return {
        name: job.name,
        schedule: job.args[0],
        frequency,
        timezone,
      };
    });

    const rows = jobsData
      .map(
        (job) => `
        <tr data-name="${this.escapeHtml(job.name.toLowerCase())}" data-frequency="${this.escapeHtml(job.frequency)}" data-timezone="${this.escapeHtml(job.timezone)}">
            <td class="name">${this.escapeHtml(job.name)}</td>
            <td class="schedule"><code>${this.escapeHtml(job.schedule)}</code></td>
            <td class="frequency">${this.escapeHtml(job.frequency)}</td>
            <td class="timezone">${this.escapeHtml(job.timezone)}</td>
        </tr>`,
      )
      .join("");

    const frequencyOptions = Array.from(frequencies)
      .sort()
      .map(
        (f) =>
          `<option value="${this.escapeHtml(f)}">${this.escapeHtml(f)}</option>`,
      )
      .join("");

    const timezoneOptions = Array.from(timezones)
      .sort()
      .map(
        (t) =>
          `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`,
      )
      .join("");

    const emptyState =
      jobs.length === 0
        ? `<tr><td colspan="4" class="empty-state">No cron jobs configured</td></tr>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cron Jobs Dashboard</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap');

        :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-card: #16161f;
            --border: #2a2a3a;
            --text-primary: #e8e8ed;
            --text-secondary: #8b8b9e;
            --accent: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.15);
            --code-bg: #1e1e2a;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        /* Custom scrollbar styles */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--bg-secondary);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #3a3a4a;
        }

        /* Firefox scrollbar */
        * {
            scrollbar-width: thin;
            scrollbar-color: var(--border) var(--bg-secondary);
        }

        body {
            font-family: 'Outfit', system-ui, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            overflow: hidden;
            background-image: 
                radial-gradient(ellipse at top, var(--accent-glow) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 40%);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 3rem 2rem;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        header {
            margin-bottom: 3rem;
            flex-shrink: 0;
        }

        .header-content {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 0.5rem;
        }

        .icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--accent), #8b5cf6);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        h1 {
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1rem;
            margin-left: 4rem;
        }

        .stats {
            display: flex;
            gap: 1.5rem;
            margin-bottom: 2rem;
            flex-shrink: 0;
        }

        .filters {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
            flex-shrink: 0;
        }

        .search-box {
            flex: 1;
            min-width: 200px;
            position: relative;
        }

        .search-box input {
            width: 100%;
            padding: 0.75rem 1rem 0.75rem 2.75rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 0.9rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-box input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .search-box input::placeholder {
            color: var(--text-secondary);
        }

        .search-box svg {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            color: var(--text-secondary);
            pointer-events: none;
        }

        .filter-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .filter-group label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .filter-group select {
            padding: 0.75rem 2rem 0.75rem 1rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 0.9rem;
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b8b9e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 0.75rem center;
            min-width: 160px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .filter-group select:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .no-results {
            text-align: center;
            padding: 3rem 2rem;
            color: var(--text-secondary);
            display: none;
        }

        .no-results.visible {
            display: block;
        }

        tr.hidden {
            display: none;
        }

        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.25rem 1.5rem;
            min-width: 140px;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--accent);
        }

        .stat-label {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }

        .table-container {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            overflow: hidden;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .table-scroll {
            overflow-y: auto;
            flex: 1;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        thead {
            background: var(--bg-secondary);
            position: sticky;
            top: 0;
            z-index: 1;
        }

        th {
            padding: 1rem 1.5rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border);
        }

        td {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover {
            background: rgba(99, 102, 241, 0.03);
        }

        .name {
            font-weight: 600;
            color: var(--text-primary);
        }

        .schedule code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            background: var(--code-bg);
            padding: 0.35rem 0.65rem;
            border-radius: 6px;
            color: var(--accent);
            border: 1px solid var(--border);
        }

        .frequency {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        .timezone {
            color: var(--text-secondary);
            font-size: 0.85rem;
        }

        .timezone code {
            font-family: 'JetBrains Mono', monospace;
            background: var(--code-bg);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            border: 1px solid var(--border);
        }

        .empty-state {
            text-align: center;
            padding: 4rem 2rem !important;
            color: var(--text-secondary);
        }

        .footer {
            margin-top: 2rem;
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.875rem;
            flex-shrink: 0;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1.5rem 1rem;
            }

            .stats {
                flex-wrap: wrap;
            }

            .filters {
                flex-direction: column;
            }

            .search-box {
                min-width: 100%;
            }

            .filter-group {
                width: 100%;
            }

            .filter-group select {
                flex: 1;
            }

            .table-scroll {
                overflow-x: auto;
            }

            table {
                min-width: 700px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="header-content">
                <div class="icon">⏰</div>
                <h1>Cron Jobs</h1>
            </div>
            <p class="subtitle">Scheduled tasks dashboard</p>
        </header>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" id="total-jobs">${jobs.length}</div>
                <div class="stat-label">Total Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="visible-jobs">${jobs.length}</div>
                <div class="stat-label">Showing</div>
            </div>
        </div>

        <div class="filters">
            <div class="search-box">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="search-input" placeholder="Search by name...">
            </div>
            <div class="filter-group">
                <label for="frequency-filter">Frequency</label>
                <select id="frequency-filter">
                    <option value="">All Frequencies</option>
                    ${frequencyOptions}
                </select>
            </div>
            <div class="filter-group">
                <label for="timezone-filter">Timezone</label>
                <select id="timezone-filter">
                    <option value="">All Timezones</option>
                    ${timezoneOptions}
                </select>
            </div>
        </div>

        <div class="table-container">
            <div class="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Schedule</th>
                            <th>Frequency</th>
                            <th>Timezone</th>
                        </tr>
                    </thead>
                    <tbody id="jobs-tbody">
                        ${rows || emptyState}
                    </tbody>
                </table>
                <div class="no-results" id="no-results">
                    No jobs match your filters
                </div>
            </div>
        </div>

        <div class="footer">
            Generated by Balda.js
        </div>
    </div>

    <script>
        (function() {
            const searchInput = document.getElementById('search-input');
            const frequencyFilter = document.getElementById('frequency-filter');
            const timezoneFilter = document.getElementById('timezone-filter');
            const tbody = document.getElementById('jobs-tbody');
            const noResults = document.getElementById('no-results');
            const visibleJobsCount = document.getElementById('visible-jobs');

            function filterJobs() {
                const searchTerm = searchInput.value.toLowerCase().trim();
                const selectedFrequency = frequencyFilter.value;
                const selectedTimezone = timezoneFilter.value;

                const rows = tbody.querySelectorAll('tr[data-name]');
                let visibleCount = 0;

                rows.forEach(row => {
                    const name = row.getAttribute('data-name') || '';
                    const frequency = row.getAttribute('data-frequency') || '';
                    const timezone = row.getAttribute('data-timezone') || '';

                    const matchesSearch = !searchTerm || name.includes(searchTerm);
                    const matchesFrequency = !selectedFrequency || frequency === selectedFrequency;
                    const matchesTimezone = !selectedTimezone || timezone === selectedTimezone;

                    if (matchesSearch && matchesFrequency && matchesTimezone) {
                        row.classList.remove('hidden');
                        visibleCount++;
                    } else {
                        row.classList.add('hidden');
                    }
                });

                visibleJobsCount.textContent = visibleCount;
                noResults.classList.toggle('visible', visibleCount === 0 && rows.length > 0);
            }

            searchInput.addEventListener('input', filterJobs);
            frequencyFilter.addEventListener('change', filterJobs);
            timezoneFilter.addEventListener('change', filterJobs);
        })();
    </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

export const cronUIInstance = new CronUI();
