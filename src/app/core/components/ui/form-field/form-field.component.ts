import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../i18n/t.pipe';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './form-field.component.html',
})
export class FormFieldComponent {
  @Input() forId = '';
  @Input() label = '';
  @Input() labelKey = '';
  @Input() hint = '';
  @Input() hintKey = '';
  @Input() error = '';
  @Input() errorKey = '';
  @Input() required = false;
}

