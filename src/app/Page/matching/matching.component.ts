import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatchingApiService, MatchCandidate } from '../../core/services/matching-api-service';

@Component({
  selector: 'app-matching',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './matching.component.html'
})
export class MatchingComponent {
  loading = false;
  error = '';
  results: MatchCandidate[] = [];

  form;

  constructor(private fb: FormBuilder, private api: MatchingApiService) {
    this.form = this.fb.group({
      job_title: ['', Validators.required],
      required_skills: ['python, sql', Validators.required],
      min_experience: [0, [Validators.required, Validators.min(0)]],
      limit: [10, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
  }

  submit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.error = '';
    this.results = [];

    const rawSkills = this.form.value.required_skills ?? '';
    const required_skills = rawSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    this.api.matchJob({
      job_title: this.form.value.job_title!,
      required_skills,
      min_experience: Number(this.form.value.min_experience ?? 0),
      limit: Number(this.form.value.limit ?? 10)
    }).subscribe({
      next: (res) => {
        this.results = res.ranked ?? res.candidates ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Matching request failed.';
        this.loading = false;
      }
    });
  }
}
