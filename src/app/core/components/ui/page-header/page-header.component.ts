import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../i18n/t.pipe';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() titleKey = '';
  @Input() subtitle = '';
  @Input() subtitleKey = '';
}

