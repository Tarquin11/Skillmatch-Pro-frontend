import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  CandidateSkillExtraction,
  CandidateUploadResponse,
  CandidatesApiService,
} from '../../core/services/candidates-api.service';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../core/components/ui/empty-state/empty-state.component';
import { UxTelemetryService } from '../../core/services/ux-telemetry.service';

@Component({
  selector: 'app-cv-upload',
  standalone: true,
  imports: [
    CommonModule,
    TPipe,
    PageHeaderComponent,
    FormFieldComponent,
    DataTableComponent,
    EmptyStateComponent,
  ],
  templateUrl: './cv-upload.component.html',
})
export class CvUploadComponent implements OnDestroy {
  readonly maxFileSizeMb = 10;
  readonly allowedExtensions = ['pdf', 'docx'];
  private readonly allowedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

  selectedFile: File | null = null;
  lastAttemptedFile: File | null = null;
  uploadProgress = 0;
  uploading = false;

  validationErrorKey = '';
  requestErrorMessage = '';
  result: CandidateUploadResponse | null = null;

  constructor(
    private readonly api: CandidatesApiService,
    private readonly telemetry: UxTelemetryService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
  ) {}

  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.item(0) ?? null;

    this.selectedFile = file;
    this.lastAttemptedFile = null;
    this.result = null;
    this.uploadProgress = 0;
    this.requestErrorMessage = '';
    this.validationErrorKey = '';

    if (!file) {
      this.validationErrorKey = 'cvUpload.validation.required';
      return;
    }

    this.validationErrorKey = this.validateFile(file) ?? '';
  }

  prepareFileSelection(event: Event): void {
    if (this.uploading) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLInputElement | null;
    if (target) {
      target.value = '';
    }
  }

  submit(): void {
    if (!this.selectedFile) {
      this.validationErrorKey = 'cvUpload.validation.required';
      return;
    }
    if (this.validationErrorKey) {
      return;
    }
    this.upload(this.selectedFile);
  }

  retry(): void {
    if (!this.lastAttemptedFile || this.uploading) {
      return;
    }
    this.telemetry.track('cv_upload_retry_clicked', {
      file_extension: this.fileExtension(this.lastAttemptedFile.name),
      file_size_kb: Math.round(this.lastAttemptedFile.size / 1024),
    });
    this.upload(this.lastAttemptedFile);
  }

  openReviewQueue(): void {
    this.telemetry.track('cv_upload_open_review_queue_clicked');
    this.router.navigate(['/admin/learning']);
  }

  ngOnDestroy(): void {
    if (this.selectedFile && !this.uploading && !this.result) {
      this.telemetry.track('cv_upload_form_abandoned', {
        file_extension: this.fileExtension(this.selectedFile.name),
        file_size_kb: Math.round(this.selectedFile.size / 1024),
      });
    }
  }

  confidenceLabel(item: CandidateSkillExtraction): string {
    const value = Number(item.confidence ?? 0);
    if (!Number.isFinite(value)) return '0%';
    return `${(value * 100).toFixed(1)}%`;
  }

  confidenceNormalizedLabel(item: CandidateSkillExtraction): string {
    const value = Number(item.confidence_normalized ?? 0);
    if (!Number.isFinite(value)) return '0%';
    return `${(value * 100).toFixed(1)}%`;
  }

  sourceLabelKey(item: CandidateSkillExtraction): string {
    const label = (item.source_label ?? '').trim().toLowerCase();
    if (label) return `cvUpload.result.sourceLabel.${label}`;

    const source = (item.source ?? '').toLowerCase();
    if (source.startsWith('exact') || source.startsWith('fuzzy') || source.startsWith('synonym')) {
      return 'cvUpload.result.sourceLabel.exact';
    }
    if (source.startsWith('cv_section:')) return 'cvUpload.result.sourceLabel.section';
    if (source.startsWith('ner_span:')) return 'cvUpload.result.sourceLabel.ner';
    if (source.startsWith('semantic_augment')) return 'cvUpload.result.sourceLabel.augment';
    if (source.startsWith('semantic:')) return 'cvUpload.result.sourceLabel.semantic';
    if (source.startsWith('sentence_')) return 'cvUpload.result.sourceLabel.sentence';
    if (source.startsWith('softskill')) return 'cvUpload.result.sourceLabel.softskill';
    if (source.startsWith('legacy')) return 'cvUpload.result.sourceLabel.legacy';
    return 'cvUpload.result.sourceLabel.other';
  }

  confidenceBandLabelKey(item: CandidateSkillExtraction): string {
    const band = this.resolveConfidenceBand(item);
    return `cvUpload.result.band.${band}`;
  }

  confidenceBandClasses(item: CandidateSkillExtraction): string {
    const band = this.resolveConfidenceBand(item);
    if (band === 'high') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (band === 'medium') {
      return 'bg-amber-100 text-amber-900 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  queuedUnknownEntities(): string[] {
    const queued = this.result?.queued_unknown_entities;
    return Array.isArray(queued) ? queued : [];
  }

  private resolveConfidenceBand(item: CandidateSkillExtraction): 'low' | 'medium' | 'high' {
    const explicit = (item.confidence_band ?? '').toLowerCase();
    if (explicit === 'high' || explicit === 'medium' || explicit === 'low') {
      return explicit;
    }
    const confidence = Number(item.confidence ?? 0);
    if (confidence >= 0.78) return 'high';
    if (confidence >= 0.64) return 'medium';
    return 'low';
  }

  private upload(file: File): void {
    this.uploading = true;
    this.uploadProgress = 0;
    this.result = null;
    this.requestErrorMessage = '';
    this.lastAttemptedFile = file;

    this.api
      .uploadCv(file)
      .pipe(
        finalize(() => {
          this.uploading = false;
        }),
      )
      .subscribe({
        next: (event: HttpEvent<CandidateUploadResponse>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadProgress = Math.round((event.loaded / event.total) * 100);
            this.cdr.markForCheck();
          } else if (event.type === HttpEventType.Response) {
            this.uploadProgress = 100;
            this.result = event.body ?? null;
            this.cdr.markForCheck();
          }
        },
        error: (err: unknown) => {
          this.uploadProgress = 0;
          this.telemetry.track('cv_upload_failed', {
            file_extension: this.fileExtension(file.name),
            file_size_kb: Math.round(file.size / 1024),
          });
          this.requestErrorMessage = this.extractErrorMessage(err);
          this.cdr.markForCheck();
        },
      });
  }

  private validateFile(file: File): string | null {
    if (!file.name?.trim()) {
      return 'cvUpload.validation.required';
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.allowedExtensions.includes(extension)) {
      return 'cvUpload.validation.type';
    }

    if (file.type && !this.allowedMimeTypes.has(file.type)) {
      return 'cvUpload.validation.type';
    }

    if (file.size <= 0) {
      return 'cvUpload.validation.empty';
    }

    const maxBytes = this.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return 'cvUpload.validation.size';
    }

    return null;
  }

  private extractErrorMessage(err: unknown): string {
    const httpErr = err as HttpErrorResponse;
    const backendMessage = httpErr?.error?.detail?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage;
    }
    return 'Upload failed. Please retry.';
  }

  private fileExtension(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    return ext ?? '';
  }
}
