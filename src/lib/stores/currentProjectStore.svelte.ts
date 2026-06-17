interface SharedUser {
  user_id: number
  username: string
  email: string
  permission_level: string
}

export interface ApiProject {
  id: number
  name: string
  description: string
  graph?: unknown
  updated_at: string
  owner: { username: string }
  shared_users?: SharedUser[]
}

// Store for the currently active project
let currentProject = $state<ApiProject | null>(null)
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

  set(project: ApiProject) {
    currentProject = project
    // localStorage.setItem('currentProject', JSON.stringify(project))
  },

  clear() {
    currentProject = null
  },

  updateName(name: string) {
    if (currentProject) {
      currentProject = { ...currentProject, name }
    }
  },
}
