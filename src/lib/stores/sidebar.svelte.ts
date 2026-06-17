let isSideBarExpanded = $state(false)

export const sideBarState = {
  get isExpanded() {
    return isSideBarExpanded
  },
  toggle() {
    isSideBarExpanded = !isSideBarExpanded
  },
}
