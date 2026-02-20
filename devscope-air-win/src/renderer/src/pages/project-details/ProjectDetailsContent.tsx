import { ProjectDetailsSidebar } from './ProjectDetailsSidebar'
import { ProjectDetailsHeaderSection } from './ProjectDetailsHeaderSection'
import { ProjectDetailsReadmeTab } from './ProjectDetailsReadmeTab'
import { ProjectDetailsFilesTab } from './ProjectDetailsFilesTab'
import { ProjectDetailsGitTab } from './ProjectDetailsGitTab'

export interface ProjectDetailsContentProps {
    [key: string]: any
}

export function ProjectDetailsContent(props: ProjectDetailsContentProps) {
    const {
        activeTab,
        project,
        scriptPredictions,
        scriptIntentContext,
        runScript,
        setShowDependenciesModal
    } = props

    return (
        <>
            <ProjectDetailsHeaderSection {...props} />

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden min-h-[500px] shadow-sm">
                        {activeTab === 'readme' ? (
                            <ProjectDetailsReadmeTab {...props} />
                        ) : activeTab === 'files' ? (
                            <ProjectDetailsFilesTab {...props} />
                        ) : activeTab === 'git' ? (
                            <ProjectDetailsGitTab {...props} />
                        ) : null}
                    </div>
                </div>

                <ProjectDetailsSidebar
                    scripts={project.scripts}
                    dependencies={project.dependencies}
                    scriptPredictions={scriptPredictions}
                    scriptIntentContext={scriptIntentContext}
                    onRunScript={runScript}
                    onShowDependencies={() => setShowDependenciesModal(true)}
                />
            </div>
        </>
    )
}
