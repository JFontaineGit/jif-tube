import { Component } from "@angular/core"
import { Router,RouterModule } from "@angular/router"
import { CommonModule } from "@angular/common"

interface NavItem {
  label: string
  icon: string
  route: string
  active: boolean
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.scss"],
})
export class SidebarComponent {
  navItems: NavItem[] = [
    { label: "Home", icon: "home", route: "/", active: true },
    { label: "Library", icon: "library_music", route: "/library", active: false },
    { label: "History", icon: "history", route: "/history", active: false },
  ]

  settingsItem: NavItem = { label: "Settings", icon: "settings", route: "/settings", active: false }

  constructor(private router: Router) {
    // Actualizar el ítem activo basado en la ruta actual
    this.updateActiveItem(this.router.url)

    // Suscribirse a cambios de ruta
    this.router.events.subscribe((event: any) => {
      if (event.url) {
        this.updateActiveItem(event.url)
      }
    })
  }

  updateActiveItem(url: string): void {
    // Resetear todos los items
    this.navItems.forEach((item) => (item.active = false))
    this.settingsItem.active = false

    // Activar el ítem correspondiente
    const activeItem = this.navItems.find((item) => url === item.route || url.startsWith(item.route + "/"))
    if (activeItem) {
      activeItem.active = true
    } else if (url === this.settingsItem.route || url.startsWith(this.settingsItem.route + "/")) {
      this.settingsItem.active = true
    }
  }

  navigate(route: string): void {
    this.router.navigate([route])
  }
}
