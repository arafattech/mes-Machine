export interface SubItem {
  text: string;
  permission?: string;
  routerLink: string;
}

export interface MenuItem {
  text: string;
  icon: string;
  slot?: string;
  expanded: boolean;
  permission?: string;
  routerLink?: string;
  subItems?: SubItem[];
}

export interface SidebarGroup {
  text: string;
  expanded: boolean;
  permission?: string;
  items: MenuItem[];
}