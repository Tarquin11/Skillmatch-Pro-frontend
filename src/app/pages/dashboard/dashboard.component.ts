import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchingApiService, ModelInfoResponse } from '../../core/services/matching-api.service';
import { TPipe } from '../../core/i18n/t.pipe';

type TriState = boolean | null | undefined;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  loading = true;
  errorKey = '';
  info: ModelInfoResponse | null = null;

  constructor(private readonly api: MatchingApiService) {}

  ngOnInit(): void {
    this.api.getModelInfo().subscribe({
      next: (res) => {
        this.info = res;
        this.loading = false;
      },
      error: () => {
        this.errorKey = 'dashboard.error.load';
        this.loading = false;
      },
    });
  }

  statusTextKey(status: TriState): string {
    if (status === true) return 'dashboard.badge.pass';
    if (status === false) return 'dashboard.badge.fail';
    return 'dashboard.badge.unknown';
  }

  statusBadgeClass(status: TriState): string {
    if (status === true) return 'bg-green-100 text-green-800 border-green-200';
    if (status === false) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  formatTimestamp(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  metricValue(key: string): string {
    const raw = this.info?.metrics?.[key];
    if (raw === undefined || raw === null || Number.isNaN(raw)) return 'N/A';
    return raw.toFixed(3);
  }
}
