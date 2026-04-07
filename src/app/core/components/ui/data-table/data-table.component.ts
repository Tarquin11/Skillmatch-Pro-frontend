import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { TPipe } from '../../../i18n/t.pipe';
import { TableDensity, UiPreferencesService } from '../../../services/ui-preferences.service';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, TPipe],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent implements OnInit, OnDestroy {
  @Input() loading = false;
  @Input() hasRows = false;
  @Input() showEmpty = true;
  @Input() showDensityToggle = true;
  @Input() skeletonRows = 6;
  @Input() skeletonCols = 5;
  @Input() loadingKey = 'common.loading';
  @Input() emptyTitleKey = '';
  @Input() emptySubtitleKey = '';

  density: TableDensity = 'comfortable';
  private densitySub?: Subscription;

  constructor(private readonly preferences: UiPreferencesService) {}

  ngOnInit(): void {
    this.densitySub = this.preferences.tableDensity$.subscribe((value) => {
      this.density = value;
    });
  }

  ngOnDestroy(): void {
    this.densitySub?.unsubscribe();
  }

  setDensity(value: TableDensity): void {
    this.preferences.setTableDensity(value);
  }

  skeletonRowsArray(): number[] {
    const count = Number.isFinite(this.skeletonRows) ? Math.max(1, Math.floor(this.skeletonRows)) : 6;
    return Array.from({ length: count }, (_, i) => i);
  }

  skeletonColsArray(): number[] {
    const count = Number.isFinite(this.skeletonCols) ? Math.max(2, Math.floor(this.skeletonCols)) : 5;
    return Array.from({ length: count }, (_, i) => i);
  }
}
