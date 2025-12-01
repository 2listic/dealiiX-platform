// Store for the currently active project
let currentProject = $state()
// TODO: store the current project in localStorage together with the graph data and load it at startup
// let currentProject = $state(JSON.parse(localStorage.getItem('currentProject')))

export const currentProjectState = {
  get current() {
    return currentProject
  },

  get id() {
    return currentProject?.id ?? null
  },

  get name() {
    return currentProject?.name ?? 'Untitled Project'
  },

  set(project) {
    currentProject = project
    // localStorage.setItem('currentProject', JSON.stringify(project))
  },

  clear() {
    currentProject = null
  },

  // Update just the name (useful if you add rename functionality)
  updateName(name) {
    if (currentProject) {
      currentProject = { ...currentProject, name }
    }
  },
}
