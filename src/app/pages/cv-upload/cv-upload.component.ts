import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
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

  private upload(file: File): void {
    this.uploading = true;
    this.uploadProgress = 0;
    this.result = null;
    this.requestErrorMessage = '';
    this.lastAttemptedFile = file;

    this.api.uploadCv(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? file.size;
          if (total > 0) {
            this.uploadProgress = Math.min(100, Math.round((event.loaded / total) * 100));
          }
          return;
        }

        if (event.type === HttpEventType.Response) {
          this.uploadProgress = 100;
          this.result = event.body ?? null;
          this.uploading = false;
        }
      },
      error: (err: unknown) => {
        this.uploading = false;
        this.uploadProgress = 0;
        this.telemetry.track('cv_upload_failed', {
          file_extension: this.fileExtension(file.name),
          file_size_kb: Math.round(file.size / 1024),
        });
        this.requestErrorMessage = this.extractErrorMessage(err);
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
