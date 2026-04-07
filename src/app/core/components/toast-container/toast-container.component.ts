import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../i18n/t.pipe';
import { ToastItem, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './toast-container.component.html',
})
export class ToastContainerComponent {
  constructor(private readonly toast: ToastService) {}

  toasts(): ToastItem[] {
    return this.toast.items();
  }

  dismiss(id: number): void {
    this.toast.dismiss(id);
  }

  levelClass(level: ToastItem['level']): string {
    if (level === 'success') return 'toast-success';
    if (level === 'info') return 'toast-info';
    return 'toast-error';
  }
}
