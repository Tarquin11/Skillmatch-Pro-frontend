import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../i18n/t.pipe';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() titleKey = '';
  @Input() subtitle = '';
  @Input() subtitleKey = '';
}

