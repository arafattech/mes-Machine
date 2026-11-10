import { expandActiveSidebarGroups } from './sidebar-active';

const menu = () => [
  {
    expanded: false,
    items: [
      { routerLink: 'products', expanded: false, subItems: [{ routerLink: 'product-type' }, { routerLink: 'uom-list' }] },
      { routerLink: 'departments', expanded: false },
    ],
  },
  { expanded: false, items: [{ routerLink: 'supplier', expanded: false }] },
];

describe('expandActiveSidebarGroups', () => {
  it('opens the item and group that hold the current sub item, and nothing else', () => {
    const groups = menu();
    expandActiveSidebarGroups(groups, (link) => link === 'uom-list');

    expect(groups[0].expanded).toBeTrue();
    expect(groups[0].items[0].expanded).toBeTrue();
    expect(groups[0].items[1].expanded).toBeFalse();
    expect(groups[1].expanded).toBeFalse();
  });

  it('opens only the group for a top-level item', () => {
    const groups = menu();
    expandActiveSidebarGroups(groups, (link) => link === 'supplier');

    expect(groups[1].expanded).toBeTrue();
    expect(groups[1].items[0].expanded).toBeFalse();
    expect(groups[0].expanded).toBeFalse();
  });

  it('never collapses what is already open', () => {
    const groups = menu();
    groups[1].expanded = true;
    expandActiveSidebarGroups(groups, (link) => link === 'uom-list');

    expect(groups[1].expanded).toBeTrue();
  });
});
