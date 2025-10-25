import { ApplicationRef, EnvironmentInjector, Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ComponentRef, createComponent } from '@angular/core';
import { Subscription } from 'rxjs';

import { Song } from '@interfaces';
import { AnchorRect, SongOptionsMenuComponent } from './song-menu.component';

interface MenuOverlayConfig {
  song: Song;
  anchorRect: AnchorRect;
  onClosed?: () => void;
  onActionExecuted?: (action: string) => void;
  triggerElement?: HTMLElement;
}

interface ActiveOverlay {
  componentRef: ComponentRef<SongOptionsMenuComponent>;
  closedSub: Subscription;
  actionSub: Subscription;
  onClosed?: () => void;
  triggerElement?: HTMLElement;
  songId?: string;
}

@Injectable({ providedIn: 'root' })
export class SongOptionsMenuOverlayService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  private activeOverlay?: ActiveOverlay;

  open(config: MenuOverlayConfig): void {
    this.destroyActiveOverlay(true, true);

    const componentRef = createComponent(SongOptionsMenuComponent, {
      environmentInjector: this.environmentInjector,
    });

    componentRef.setInput('song', config.song);
    componentRef.setInput('anchorRect', config.anchorRect);

    this.appRef.attachView(componentRef.hostView);
    this.document.body.appendChild(componentRef.location.nativeElement);

    const closedSub = componentRef.instance.closed.subscribe(() => {
      config.onClosed?.();
      this.destroyActiveOverlay(false);
    });

    const actionSub = componentRef.instance.actionExecuted.subscribe((action) => {
      config.onActionExecuted?.(action);
    });

    componentRef.changeDetectorRef.detectChanges();

    this.activeOverlay = {
      componentRef,
      closedSub,
      actionSub,
      onClosed: config.onClosed,
      triggerElement: config.triggerElement,
      songId: config.song?.id,
    };
  }

  closeBySongId(songId: string | undefined): void {
    if (!songId) return;
    if (this.activeOverlay?.songId !== songId) return;
    this.activeOverlay.onClosed?.();
    this.destroyActiveOverlay(false, true);
  }

  private destroyActiveOverlay(emitClosed: boolean, programmaticClose = false): void {
    if (!this.activeOverlay) return;

    const { componentRef, closedSub, actionSub, onClosed, triggerElement } = this.activeOverlay;

    closedSub.unsubscribe();
    actionSub.unsubscribe();

    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();

    if (emitClosed) {
      onClosed?.();
    }

    if (!programmaticClose && triggerElement && typeof triggerElement.focus === 'function') {
      triggerElement.focus({ preventScroll: true });
    }

    this.activeOverlay = undefined;
  }
}
