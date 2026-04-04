import { Component, OnInit } from "@angular/core";
import { MatchingApiService, ModelInfoResponse } from "../../core/services/matching-api-service";
import { CommonModule } from "@angular/common";

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard.componmnt.html'
})
export class DashboardComponent implements OnInit {
    loading = true;
    error = '';
    info : ModelInfoResponse | null = null;
    constructor(private api: MatchingApiService) {}

    ngOnInit(): void {
        this.api.getModelInfo().subscribe({
            next: (res) => {
                this.info = res;
                this.loading = false;
            },
            error: () => {
                this.error = 'failed to load model info';
                this.loading = false;
            }
        });
    }
}