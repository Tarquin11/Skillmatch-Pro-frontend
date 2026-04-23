import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { EmptyStateComponent } from '../../core/components/ui/empty-state/empty-state.component';
import {
  LearningApiService,
  LearningDecision,
  LearningEntityType,
  LearningStatus,
  UnknownEntity,
} from '../../core/services/learning-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';

@Component({
  selector: 'app-learning-queue',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TPipe,
    PageHeaderComponent,
    DataTableComponent,
    FormFieldComponent,
    EmptyStateComponent,
  ],
  templateUrl: './learning-queue.component.html',
})
export class LearningQueueComponent implements OnInit {
  loading = true;
  detailLoading = false;
  saving = false;

  errorMessage = '';
  detailErrorMessage = '';
  successKey = '';

  entities: UnknownEntity[] = [];
  selectedEntityId: number | null = null;
  selectedEntity: UnknownEntity | null = null;

  currentPage = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;

  search = '';
  statusFilter: LearningStatus | 'all' = 'pending';
  entityTypeFilter: LearningEntityType | 'all' = 'all';

  readonly reviewForm;
  readonly statusOptions: Array<LearningStatus | 'all'> = ['pending', 'approved', 'rejected', 'all'];
  readonly entityTypeOptions: Array<LearningEntityType | 'all'> = [
    'skill',
    'project',
    'certification',
    'unknown',
    'all',
  ];
  readonly decisionOptions: LearningDecision[] = ['approved', 'rejected'];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: LearningApiService,
    private readonly apiErrorService: ApiErrorService,
  ) {
    this.reviewForm = this.fb.nonNullable.group({
      decision: ['approved' as LearningDecision, [Validators.required]],
      entity_type: ['skill' as LearningEntityType, [Validators.required]],
      canonical_value: [''],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.loadEntities();
  }

  applyFilters(searchValue: string): void {
    this.search = searchValue.trim();
    this.currentPage = 1;
    this.loadEntities();
  }

  clearFilters(searchBox?: HTMLInputElement | null): void {
    this.search = '';
    this.statusFilter = 'pending';
    this.entityTypeFilter = 'all';
    this.currentPage = 1;
    if (searchBox) {
      searchBox.value = '';
    }
    this.loadEntities();
  }

  refresh(): void {
    this.loadEntities(true);
  }

  prevPage(): void {
    if (!this.hasPrev || this.loading) return;
    this.currentPage -= 1;
    this.loadEntities();
  }

  nextPage(): void {
    if (!this.hasNext || this.loading) return;
    this.currentPage += 1;
    this.loadEntities();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.currentPage = 1;
    this.loadEntities();
  }

  selectEntity(entityId: number, force = false): void {
    if (!force && this.selectedEntityId === entityId && this.selectedEntity) {
      return;
    }
    this.selectedEntityId = entityId;
    this.loadSelectedEntity(entityId);
  }

  isSelected(row: UnknownEntity): boolean {
    return this.selectedEntityId === row.id;
  }

  reviewSelectedEntity(): void {
    if (!this.selectedEntity || this.reviewForm.invalid || this.saving) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    const raw = this.reviewForm.getRawValue();
    const canonicalValue = raw.canonical_value.trim();
    const notes = raw.notes.trim();

    this.saving = true;
    this.detailErrorMessage = '';
    this.successKey = '';

    this.api
      .reviewUnknownEntity(this.selectedEntity.id, {
        decision: raw.decision,
        entity_type: raw.entity_type,
        canonical_value: canonicalValue || (raw.decision === 'approved' ? this.selectedEntity.raw_value : null),
        notes: notes || null,
      })
      .pipe(
        finalize(() => {
          this.saving = false;
        }),
      )
      .subscribe({
        next: (entity) => {
          this.selectedEntity = entity;
          this.patchRow(entity);
          this.prepareReviewForm(entity);
          this.successKey = raw.decision === 'approved' ? 'learning.review.successApproved' : 'learning.review.successRejected';
          this.loadEntities(true);
        },
        error: (err: unknown) => {
          const normalized = this.apiErrorService.normalize(err);
          this.detailErrorMessage = normalized.i18nKey || normalized.message || 'errors.generic';
        },
      });
  }

  confidenceLabel(value: number | null | undefined): string {
    const confidence = Number(value ?? 0);
    if (!Number.isFinite(confidence) || confidence <= 0) {
      return '--';
    }
    return `${(confidence * 100).toFixed(1)}%`;
  }

  statusBadgeClass(status: LearningStatus): string {
    if (status === 'approved') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'rejected') return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-amber-100 text-amber-900 border-amber-200';
  }

  confidenceBandClass(entity: UnknownEntity): string {
    const band = this.resolveBand(entity);
    if (band === 'high') return 'bg-green-100 text-green-800 border-green-200';
    if (band === 'medium') return 'bg-amber-100 text-amber-900 border-amber-200';
    if (band === 'low') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  }

  confidenceBandLabelKey(entity: UnknownEntity): string {
    const band = this.resolveBand(entity);
    return band ? `cvUpload.result.band.${band}` : 'learning.band.unknown';
  }

  decisionLabelKey(decision: LearningDecision): string {
    return decision === 'approved' ? 'learning.review.decision.approved' : 'learning.review.decision.rejected';
  }

  reviewButtonKey(entity: UnknownEntity): string {
    return entity.status === 'pending' ? 'learning.table.review' : 'learning.table.reviewAgain';
  }

  pendingCount(): number {
    return this.entities.filter((entity) => entity.status === 'pending').length;
  }

  approvedCount(): number {
    return this.entities.filter((entity) => entity.status === 'approved').length;
  }

  protected resolveBand(entity: UnknownEntity): 'low' | 'medium' | 'high' | null {
    const explicit = (entity.confidence_band ?? '').toLowerCase();
    if (explicit === 'low' || explicit === 'medium' || explicit === 'high') {
      return explicit;
    }
    const confidence = Number(entity.confidence ?? 0);
    if (!Number.isFinite(confidence) || confidence <= 0) return null;
    if (confidence >= 0.78) return 'high';
    if (confidence >= 0.64) return 'medium';
    return 'low';
  }

  private loadEntities(forceReloadSelection = false): void {
    this.loading = true;
    this.errorMessage = '';

    this.api
      .listUnknownEntities({
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        status: this.statusFilter === 'all' ? undefined : this.statusFilter,
        entity_type: this.entityTypeFilter === 'all' ? undefined : this.entityTypeFilter,
        search: this.search || undefined,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (rows) => {
          this.entities = rows;
          this.hasPrev = this.currentPage > 1;
          this.hasNext = rows.length === this.pageSize;

          if (!rows.length) {
            this.selectedEntityId = null;
            this.selectedEntity = null;
            return;
          }

          const selectedExists = this.selectedEntityId !== null && rows.some((row) => row.id === this.selectedEntityId);
          if (!selectedExists) {
            this.selectEntity(rows[0].id, true);
            return;
          }

          if (forceReloadSelection && this.selectedEntityId !== null) {
            this.loadSelectedEntity(this.selectedEntityId);
          }
        },
        error: (err: unknown) => {
          const normalized = this.apiErrorService.normalize(err);
          this.errorMessage = normalized.i18nKey || normalized.message || 'errors.generic';
          this.entities = [];
          this.hasPrev = false;
          this.hasNext = false;
          this.selectedEntityId = null;
          this.selectedEntity = null;
        },
      });
  }

  private loadSelectedEntity(entityId: number): void {
    this.detailLoading = true;
    this.detailErrorMessage = '';

    this.api
      .getUnknownEntity(entityId)
      .pipe(
        finalize(() => {
          this.detailLoading = false;
        }),
      )
      .subscribe({
        next: (entity) => {
          this.selectedEntity = entity;
          this.patchRow(entity);
          this.prepareReviewForm(entity);
        },
        error: (err: unknown) => {
          const normalized = this.apiErrorService.normalize(err);
          this.detailErrorMessage = normalized.i18nKey || normalized.message || 'errors.generic';
          this.selectedEntity = null;
        },
      });
  }

  private patchRow(entity: UnknownEntity): void {
    this.entities = this.entities.map((row) => (row.id === entity.id ? { ...row, ...entity } : row));
  }

  private prepareReviewForm(entity: UnknownEntity): void {
    this.reviewForm.reset({
      decision: 'approved',
      entity_type: entity.resolved_entity_type ?? entity.entity_type_guess ?? 'skill',
      canonical_value: entity.raw_value ?? '',
      notes: '',
    });
  }
}
