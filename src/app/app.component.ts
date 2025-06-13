import {
  Component,
  OnInit,
  OnDestroy,
  Renderer2,
  RendererFactory2,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { isPlatformBrowser } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common'; 

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <ng-container *ngIf="accentColor">
        <app-sidebar [accentColor]="accentColor"></app-sidebar>
      </ng-container>
      <router-outlet></router-outlet>
    </div>
  `,
  standalone: true,
  imports: [NgIf,RouterOutlet, SidebarComponent],
  styles: [`
    .app-container {
      display: flex;
      height: 100vh;
      background: linear-gradient(to bottom, var(--gradient-start, #0f172a), var(--gradient-end, #1e2a44));
      transition: background 0.5s ease;
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  accentColor: string | null = null;
  private isBrowser = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private themeService: ThemeService,
    private rendererFactory: RendererFactory2
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const renderer = this.rendererFactory.createRenderer(null, null);

    this.themeService.gradient$
      .pipe(takeUntil(this.destroy$))
      .subscribe(gradient => {
        renderer.setStyle(document.documentElement, '--gradient-start', gradient.start);
        renderer.setStyle(document.documentElement, '--gradient-end', gradient.end);
      });

    this.themeService.dominantColor$
      .pipe(takeUntil(this.destroy$))
      .subscribe(color => {
        this.accentColor = color;
        renderer.setStyle(document.documentElement, '--dominant-color', color);
        renderer.setStyle(document.documentElement, '--accent-color', color);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
