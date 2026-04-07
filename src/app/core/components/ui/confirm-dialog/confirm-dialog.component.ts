import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../i18n/t.pipe';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() titleKey = '';
  @Input() message = '';
  @Input() messageKey = '';
  @Input() confirmLabelKey = 'common.yes';
  @Input() cancelLabelKey = 'common.no';
  @Input() danger = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.cancel.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).dataset['backdrop'] === 'true') {
      this.cancel.emit();
    }
  }
}

