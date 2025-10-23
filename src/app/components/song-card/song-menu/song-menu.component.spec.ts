import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SongMenuComponent } from './song-menu.component';

describe('SongMenuComponent', () => {
  let component: SongMenuComponent;
  let fixture: ComponentFixture<SongMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SongMenuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SongMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
