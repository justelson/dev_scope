import { indexAllFolders, scanProjects } from '../services/project-discovery-service'

export const devscopeCore = {
    projects: {
        scanProjects,
        indexAllFolders
    }
}
