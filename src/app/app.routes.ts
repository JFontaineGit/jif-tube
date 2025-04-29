import type { Routes } from "@angular/router"
import { HomePageComponent } from "./pages/home-page/home-page.component"
import { LibraryPageComponent } from "./pages/library-page/library-page.component"
import { HistoryPageComponent } from "./pages/history-page/history-page.component"
import { SettingsPageComponent } from "./pages/settings-page/settings-page.component"
import { LayoutComponent } from "./components/layout/layout.component"

export const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      { path: "", component: HomePageComponent },
      { path: "library", component: LibraryPageComponent },
      { path: "history", component: HistoryPageComponent },
      { path: "settings", component: SettingsPageComponent },
      { path: "**", redirectTo: "" },
    ],
  },
]
