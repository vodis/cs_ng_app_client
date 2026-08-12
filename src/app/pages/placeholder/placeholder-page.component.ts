import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder-page',
  standalone: false,
  template: `
    <main class="placeholder-page">
      <h1>{{ title }}</h1>
      <p>Coming soon.</p>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .placeholder-page {
        padding: clamp(1.5rem, 4vw, 2.5rem);
      }

      h1 {
        margin: 0 0 0.75rem;
        color: var(--main-text-color);
        font-size: 1.5rem;
        font-weight: 600;
      }

      p {
        margin: 0;
        color: var(--gray-30);
        font-size: 0.95rem;
      }
    `,
  ],
})
export class PlaceholderPageComponent implements OnInit {
  public title = '';

  constructor(private readonly route: ActivatedRoute) {}

  public ngOnInit(): void {
    this.title = String(this.route.snapshot.data['title'] ?? '');
  }
}
